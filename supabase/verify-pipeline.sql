-- Run as database owner after applying the pipeline migration. All fixtures roll back.
begin;
do $$
declare
  first_id uuid;
  second_id uuid;
  first_created boolean;
  second_created boolean;
  foreign_id uuid;
  result jsonb := '{"version":1,"adapter":"none","files":[{"path":"main.ts","folder":".","module":"main.ts","lines":1,"hash":"unused-sql-fixture","fanIn":0,"fanOut":0}],"edges":[],"imports":[],"coverage":{"filesFound":1,"filesParsed":1,"filesSkipped":0,"skipped":[],"excludedDirectories":[],"imports":{"resolved":0,"unresolved":0,"external":0,"excluded":0}}}';
begin
  perform set_config('request.jwt.claims', '{"role":"authenticated","o":{"id":"pipeline-verification-a"}}', true);
  set local role authenticated;
  select id, created into strict first_id, first_created from public.begin_analysis('https://github.com/verification/pipeline');
  select id, created into strict second_id, second_created from public.begin_analysis('https://github.com/verification/pipeline');
  if not first_created or second_created or first_id <> second_id then raise exception 'Repository deduplication failed'; end if;
  update public.analyses set status='running',stage='storing',commit_sha=repeat('a',40) where id=first_id;
  -- An invalid edge rolls back the inserted file as well as the completion.
  begin
    perform public.complete_analysis(first_id, jsonb_set(result, '{edges}', '[{"source":"main.ts","target":"missing.ts","kinds":["import"]}]'));
    raise exception 'Invalid edge was accepted';
  exception when raise_exception then
    if sqlerrm <> 'An edge endpoint is missing' then raise; end if;
  end;
  if exists(select 1 from public.files where analysis_id=first_id) then raise exception 'Partial storage survived failure'; end if;
  perform public.complete_analysis(first_id, result);
  if not exists(select 1 from public.analyses where id=first_id and status='completed' and parser_result=result) then raise exception 'Completion did not persist the parser contract'; end if;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"authenticated","org_id":"pipeline-verification-b"}', true);
  set local role authenticated;
  if exists(select 1 from public.analyses where id=first_id) then raise exception 'Another organization can read the analysis'; end if;
  update public.analyses set stage_message='foreign update' where id=first_id;
  if found then raise exception 'Another organization can update the analysis'; end if;
  begin
    insert into public.files(organization_id,analysis_id,path) values ('pipeline-verification-a',first_id,'foreign.ts');
    raise exception 'Foreign insert was accepted';
  exception when insufficient_privilege then null;
  end;
  select id into strict foreign_id from public.begin_analysis('https://github.com/verification/pipeline');
  if foreign_id=first_id then raise exception 'Organizations shared an analysis'; end if;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;
  begin
    perform public.begin_analysis('https://github.com/verification/missing-claim');
    raise exception 'Missing organization was accepted';
  exception when raise_exception then
    if sqlerrm <> 'An organization is required' then raise; end if;
  end;
  reset role;
end $$;
rollback;
