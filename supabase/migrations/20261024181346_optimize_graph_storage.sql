create or replace function public.complete_analysis(analysis_id uuid, result jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  organization text;
  current_status text;
  current_stage text;
  file_ids jsonb;
  inserted_edges bigint;
begin
  select a.organization_id, a.status, a.stage into strict organization, current_status, current_stage
    from public.analyses a where a.id = analysis_id for update;
  if current_status <> 'running' or current_stage <> 'storing' then raise exception 'Analysis is not ready to store'; end if;
  if result->>'version' is distinct from '1' or jsonb_typeof(result->'files') is distinct from 'array'
     or jsonb_typeof(result->'edges') is distinct from 'array'
     or jsonb_typeof(result->'imports') is distinct from 'array'
     or jsonb_typeof(result->'coverage') is distinct from 'object' then raise exception 'Invalid parser result'; end if;
  -- Build endpoint identities from this insert, avoiding table joins whose plans
  -- depend on statistics that do not yet include the newly inserted files.
  with inserted as (
    insert into public.files (organization_id, analysis_id, path)
      select organization, analysis_id, f.path from jsonb_to_recordset(result->'files') as f(path text)
      returning path, id
  )
  select coalesce(jsonb_object_agg(path, id), '{}'::jsonb) into file_ids from inserted;
  insert into public.edges (organization_id, analysis_id, source_file_id, target_file_id)
    select organization, analysis_id, (file_ids->>e.source)::uuid, (file_ids->>e.target)::uuid
    from jsonb_to_recordset(result->'edges') as e(source text, target text)
    where file_ids ? e.source and file_ids ? e.target;
  get diagnostics inserted_edges = row_count;
  if inserted_edges <> jsonb_array_length(result->'edges') then raise exception 'An edge endpoint is missing'; end if;
  -- The relational graph and complete parser contract still commit together.
  update public.analyses set parser_result = result, status = 'completed', stage = 'completed',
    stage_message = 'Analysis complete.', updated_at = now(), failed_stage = null, failure_message = null
    where analyses.id = analysis_id;
end $$;
