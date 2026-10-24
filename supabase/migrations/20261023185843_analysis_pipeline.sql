begin;

-- Only the explicitly approved, empty development fixtures are removed.
delete from public.analyses a using public.projects p
where a.project_id = p.id and a.commit_sha is null
  and (p.organization_id, p.repository_url) in (
    ('org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3', 'https://github.com/vercel/next.js'),
    ('org_3L6JhE5FMx3d0XMwt3oDSIoKav0', 'https://github.com/supabase/supabase'))
  and not exists (select 1 from public.files f where f.analysis_id = a.id)
  and not exists (select 1 from public.edges e where e.analysis_id = a.id)
  and not exists (select 1 from public.routes r where r.analysis_id = a.id)
  and not exists (select 1 from public.explanations e where e.analysis_id = a.id)
  and not exists (select 1 from public.file_roles r where r.analysis_id = a.id)
  and not exists (select 1 from public.insights i where i.analysis_id = a.id);

alter table public.analyses
  add constraint analyses_one_per_project unique (organization_id, project_id),
  add column stage text not null default 'queued' check (stage in ('queued', 'fetching', 'selecting', 'parsing', 'storing', 'completed', 'failed')),
  add column stage_message text not null default 'Waiting to start.',
  add column failed_stage text check (failed_stage in ('fetching', 'selecting', 'parsing', 'storing')),
  add column failure_message text,
  add column updated_at timestamptz not null default now(),
  add column parser_result jsonb;

-- Use the same Clerk claim for writes as reads. RPCs run as the caller, never
-- as the database owner, so table policies remain the authorization boundary.
do $$
declare table_name text;
begin
  foreach table_name in array array['organizations', 'projects', 'analyses', 'files', 'edges'] loop
    execute format('grant insert on public.%I to authenticated', table_name);
    execute format('create policy organization_insert on public.%I for insert to authenticated with check (%I = (select coalesce(auth.jwt()->''o''->>''id'', auth.jwt()->>''org_id'')))', table_name, case when table_name = 'organizations' then 'id' else 'organization_id' end);
  end loop;
end $$;

grant update (status, commit_sha, stage, stage_message, failed_stage, failure_message, updated_at, parser_result) on public.analyses to authenticated;
create policy organization_update on public.analyses for update to authenticated
using (organization_id = (select coalesce(auth.jwt()->'o'->>'id', auth.jwt()->>'org_id')))
with check (organization_id = (select coalesce(auth.jwt()->'o'->>'id', auth.jwt()->>'org_id')));

create function public.begin_analysis(repository_url text)
returns table (id uuid, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  organization text := coalesce(auth.jwt()->'o'->>'id', auth.jwt()->>'org_id');
  project uuid;
  analysis uuid;
begin
  if organization is null or organization = '' then raise exception 'An organization is required'; end if;
  if repository_url !~ '^https://github.com/[a-z0-9-]+/[a-z0-9_.-]+$' then raise exception 'Expected a canonical GitHub repository URL'; end if;
  insert into public.organizations (id) values (organization) on conflict do nothing;
  insert into public.projects (organization_id, repository_url)
    values (organization, begin_analysis.repository_url) on conflict do nothing;
  select p.id into strict project from public.projects p where p.repository_url = begin_analysis.repository_url;
  insert into public.analyses (organization_id, project_id) values (organization, project)
    on conflict (organization_id, project_id) do nothing returning analyses.id into analysis;
  if analysis is not null then return query select analysis, true;
  else return query select a.id, false from public.analyses a where a.project_id = project;
  end if;
end $$;

create function public.complete_analysis(analysis_id uuid, result jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare analysis public.analyses;
begin
  select a.* into strict analysis from public.analyses a where a.id = analysis_id for update;
  if analysis.status <> 'running' or analysis.stage <> 'storing' then raise exception 'Analysis is not ready to store'; end if;
  if result->>'version' is distinct from '1' or jsonb_typeof(result->'files') is distinct from 'array'
     or jsonb_typeof(result->'edges') is distinct from 'array'
     or jsonb_typeof(result->'imports') is distinct from 'array'
     or jsonb_typeof(result->'coverage') is distinct from 'object' then raise exception 'Invalid parser result'; end if;
  insert into public.files (organization_id, analysis_id, path)
    select analysis.organization_id, analysis.id, f->>'path' from jsonb_array_elements(result->'files') f;
  insert into public.edges (organization_id, analysis_id, source_file_id, target_file_id)
    select analysis.organization_id, analysis.id, source.id, target.id
    from jsonb_array_elements(result->'edges') e
    join public.files source on source.analysis_id = analysis.id and source.path = e->>'source'
    join public.files target on target.analysis_id = analysis.id and target.path = e->>'target';
  if (select count(*) from public.edges e where e.analysis_id = analysis.id) <> jsonb_array_length(result->'edges') then
    raise exception 'An edge endpoint is missing';
  end if;
  -- Keep the versioned parser contract intact: metadata, import reasons and
  -- coverage survive alongside relational file/edge identities, atomically.
  update public.analyses set parser_result = result, status = 'completed', stage = 'completed',
    stage_message = 'Analysis complete.', updated_at = now(), failed_stage = null, failure_message = null
    where analyses.id = analysis.id;
end $$;

revoke all on function public.begin_analysis(text), public.complete_analysis(uuid, jsonb) from public, anon;
grant execute on function public.begin_analysis(text), public.complete_analysis(uuid, jsonb) to authenticated;

commit;
