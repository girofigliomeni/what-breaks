begin;

alter table public.analyses add column run_id uuid not null default gen_random_uuid();
grant update (run_id) on public.analyses to authenticated;
grant delete on public.analyses to authenticated;
create policy organization_delete on public.analyses for delete to authenticated
using (organization_id = (select coalesce(auth.jwt()->'o'->>'id', auth.jwt()->>'org_id'))
  and (status in ('completed', 'failed') or updated_at <= now() - interval '5 minutes'));

create function public.retry_analysis(analysis_id uuid)
returns table (id uuid, run_id uuid, repository_url text)
language plpgsql security invoker set search_path = '' as $$
declare analysis public.analyses;
begin
  select a.* into strict analysis from public.analyses a where a.id = analysis_id for update;
  if analysis.status <> 'failed' and not
    (analysis.status <> 'completed' and analysis.updated_at <= now() - interval '5 minutes')
    then raise exception 'Only failed or stale analyses can be retried'; end if;
  update public.analyses a set status = 'queued', stage = 'queued',
    stage_message = 'Waiting to start.', failed_stage = null, failure_message = null,
    commit_sha = null, parser_result = null, run_id = gen_random_uuid(), updated_at = now()
    where a.id = analysis_id;
  return query select a.id, a.run_id, p.repository_url from public.analyses a
    join public.projects p on p.id = a.project_id where a.id = analysis_id;
end $$;

create function public.remove_analysis(analysis_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare analysis public.analyses;
begin
  select a.* into strict analysis from public.analyses a where a.id = analysis_id for update;
  if analysis.status not in ('completed', 'failed') and analysis.updated_at > now() - interval '5 minutes'
    then raise exception 'An active analysis cannot be removed'; end if;
  -- Existing foreign keys cascade all graph and explanation rows atomically.
  delete from public.analyses a where a.id = analysis_id;
end $$;

create function public.complete_analysis_run(analysis_id uuid, result jsonb, expected_run_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_run uuid;
begin
  select a.run_id into strict current_run from public.analyses a where a.id = analysis_id for update;
  if current_run is distinct from expected_run_id then raise exception 'This analysis run has been replaced'; end if;
  perform public.complete_analysis(analysis_id, result);
end $$;

revoke all on function public.retry_analysis(uuid), public.remove_analysis(uuid),
  public.complete_analysis_run(uuid, jsonb, uuid) from public, anon;
grant execute on function public.retry_analysis(uuid), public.remove_analysis(uuid) to authenticated;
grant execute on function public.complete_analysis_run(uuid, jsonb, uuid) to service_role;

create function private.publish_analysis_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into realtime.messages (topic, event, payload, private, extension) values
    ('organization:' || old.organization_id || ':analyses', 'progress',
      jsonb_build_object('stage', 'failed', 'message', 'Analysis removed.'), true, 'broadcast');
  return old;
end $$;
revoke all on function private.publish_analysis_removal() from public, anon, authenticated;
create trigger analysis_removal after delete on public.analyses
for each row execute function private.publish_analysis_removal();

commit;
