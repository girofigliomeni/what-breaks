-- Database-owner check. Fixtures and broadcasts roll back.
begin;
do $$
declare
  target_id uuid;
  original_run uuid;
  retry_run uuid;
  result jsonb := '{"version":1,"files":[{"path":"main.ts"}],"edges":[],"imports":[],"coverage":{}}';
begin
  if has_function_privilege('anon','public.retry_analysis(uuid)','execute')
    or has_function_privilege('anon','public.remove_analysis(uuid)','execute')
    or has_function_privilege('authenticated','public.complete_analysis_run(uuid,jsonb,uuid)','execute') then
    raise exception 'Lifecycle functions have excessive execution privileges'; end if;
  perform set_config('request.jwt.claims', '{"role":"authenticated","o":{"id":"lifecycle-verification-a"}}', true);
  set local role authenticated;
  select id into strict target_id from public.begin_analysis('https://github.com/verification/lifecycle');
  select run_id into strict original_run from public.analyses where id=target_id;
  begin
    perform public.retry_analysis(target_id);
    raise exception 'Active retry accepted';
  exception when raise_exception then
    if sqlerrm <> 'Only failed or stale analyses can be retried' then raise; end if;
  end;
  begin
    perform public.remove_analysis(target_id);
    raise exception 'Active removal accepted';
  exception when raise_exception then
    if sqlerrm <> 'An active analysis cannot be removed' then raise; end if;
  end;
  update public.analyses set status='failed',stage='failed',failed_stage='fetching',failure_message='Fixture failure' where id=target_id;
  select run_id into strict retry_run from public.retry_analysis(target_id);
  if retry_run=original_run then raise exception 'Retry reused the old run identity'; end if;
  if not exists(select 1 from public.analyses where id=target_id and status='queued' and failed_stage is null and failure_message is null) then
    raise exception 'Retry did not reset failure state'; end if;
  begin
    perform public.retry_analysis(target_id);
    raise exception 'Duplicate retry accepted';
  exception when raise_exception then
    if sqlerrm <> 'Only failed or stale analyses can be retried' then raise; end if;
  end;
  update public.analyses set status='running',stage='storing' where id=target_id;
  reset role;
  set local role service_role;
  begin
    perform public.complete_analysis_run(target_id,result,original_run);
    raise exception 'Old writer completed a newer run';
  exception when raise_exception then
    if sqlerrm <> 'This analysis run has been replaced' then raise; end if;
  end;
  perform public.complete_analysis_run(target_id,result,retry_run);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"authenticated","o":{"id":"lifecycle-verification-b"}}', true);
  set local role authenticated;
  begin
    perform public.retry_analysis(target_id);
    raise exception 'Foreign retry accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.remove_analysis(target_id);
    raise exception 'Foreign removal accepted';
  exception when no_data_found then null;
  end;
  delete from public.analyses where id=target_id;
  if found then raise exception 'Foreign direct delete accepted'; end if;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"authenticated","o":{"id":"lifecycle-verification-a"}}', true);
  set local role authenticated;
  begin
    perform public.retry_analysis(target_id);
    raise exception 'Completed retry accepted';
  exception when raise_exception then
    if sqlerrm <> 'Only failed or stale analyses can be retried' then raise; end if;
  end;
  perform public.remove_analysis(target_id);
  if exists(select 1 from public.analyses where id=target_id) or exists(select 1 from public.files where files.analysis_id=target_id) then
    raise exception 'Removal did not cascade'; end if;
  select id into strict target_id from public.begin_analysis('https://github.com/verification/lifecycle');
  update public.analyses set status='running',updated_at=now()-interval '6 minutes' where id=target_id;
  perform public.retry_analysis(target_id);
  update public.analyses set updated_at=now()-interval '6 minutes' where id=target_id;
  perform public.remove_analysis(target_id);
  reset role;
end $$;
rollback;
