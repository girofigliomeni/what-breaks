begin;

-- Submission needs only the tenant and project columns. Pipeline state must
-- not be supplied on INSERT or mutated directly by an authenticated client.
revoke update on public.analyses from authenticated;
revoke update (status, commit_sha, stage, stage_message, failed_stage, failure_message, updated_at, parser_result, run_id)
  on public.analyses from authenticated;
revoke insert on public.analyses from authenticated;
grant insert (organization_id, project_id) on public.analyses to authenticated;
drop policy organization_update on public.analyses;

revoke insert, update, delete on public.files, public.edges from authenticated;
drop policy organization_insert on public.files;
drop policy organization_insert on public.edges;
revoke execute on function public.complete_analysis(uuid, jsonb), public.retry_analysis(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_analysis(uuid, jsonb), public.retry_analysis(uuid) to service_role;

-- FOR UPDATE needs an UPDATE grant. Instead let DELETE lock the row and
-- recheck its existing RLS eligibility if it races a retry or stage change.
create or replace function public.remove_analysis(analysis_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare analysis public.analyses;
begin
  select a.* into strict analysis from public.analyses a where a.id = analysis_id;
  if analysis.status not in ('completed', 'failed') and analysis.updated_at > now() - interval '5 minutes'
    then raise exception 'An active analysis cannot be removed'; end if;
  delete from public.analyses a where a.id = analysis_id;
  if not found then raise exception 'An active analysis cannot be removed'; end if;
end $$;

commit;
