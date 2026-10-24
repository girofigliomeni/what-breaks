-- Run as database owner. Tests real Realtime authorization; fixtures roll back.
begin;
do $verify$
declare
  analysis_a uuid;
  analysis_b uuid;
  project_a uuid;
  project_b uuid;
  allowed boolean[];
  writable boolean[];
  claim_a text := '{"role":"authenticated","sub":"progress-test","o":{"id":"progress-verification-a"}}';
  claim_b text := '{"role":"authenticated","sub":"progress-test","org_id":"progress-verification-b"}';
  topic_a text;
begin
  insert into public.organizations(id) values ('progress-verification-a'),('progress-verification-b');
  insert into public.projects(organization_id,repository_url) values ('progress-verification-a','https://github.com/verification/progress') returning id into project_a;
  insert into public.projects(organization_id,repository_url) values ('progress-verification-b','https://github.com/verification/progress') returning id into project_b;
  insert into public.analyses(organization_id,project_id) values ('progress-verification-a',project_a) returning id into analysis_a;
  insert into public.analyses(organization_id,project_id) values ('progress-verification-b',project_b) returning id into analysis_b;
  topic_a := 'analysis:' || analysis_a::text;
  if (select count(*) from realtime.messages where topic=topic_a and event='progress' and private and payload='{"stage":"queued","message":"Waiting to start."}'::jsonb) <> 1 then raise exception 'Queued stage was not published'; end if;
  update public.analyses set status='running',stage='parsing',stage_message='Resolving imports.' where id=analysis_a;
  if not exists(select 1 from realtime.messages where topic=topic_a and private and payload='{"stage":"parsing","message":"Resolving imports."}'::jsonb) then raise exception 'Stage change was not published'; end if;
  if not exists(select 1 from realtime.messages where topic='organization:progress-verification-a:analyses' and private and payload='{"stage":"parsing","message":"Resolving imports."}'::jsonb) then raise exception 'Dashboard stage change was not published'; end if;
  update public.analyses set status='failed',stage='failed',failed_stage='parsing',stage_message='Configuration missing.',failure_message='Configuration missing.' where id=analysis_a;
  if not exists(select 1 from realtime.messages where topic=topic_a and payload='{"stage":"failed","message":"Failed during parsing: Configuration missing."}'::jsonb) then raise exception 'Failure message lost its stage'; end if;
  if exists(select 1 from realtime.messages where topic=topic_a and payload - 'stage' - 'message' <> '{}'::jsonb) then raise exception 'Progress leaked additional row fields'; end if;

  select read_allowed,write_allowed into allowed,writable from realtime.authorize('authenticated',topic_a,claim_a,'progress-test','{}',array['broadcast'],array['broadcast']);
  if allowed is distinct from array[true] or writable is distinct from array[false] then raise exception 'Own channel must be readable but not client writable'; end if;
  select read_allowed into allowed from realtime.authorize('authenticated',topic_a,claim_b,'progress-test','{}',array['broadcast'],array[]::text[]);
  if allowed is distinct from array[false] then raise exception 'Foreign analysis channel was subscribable'; end if;
  select read_allowed into allowed from realtime.authorize('authenticated','organization:progress-verification-a:analyses',claim_a,'progress-test','{}',array['broadcast'],array[]::text[]);
  if allowed is distinct from array[true] then raise exception 'Own dashboard channel was not subscribable'; end if;
  select read_allowed into allowed from realtime.authorize('authenticated','organization:progress-verification-a:analyses',claim_b,'progress-test','{}',array['broadcast'],array[]::text[]);
  if allowed is distinct from array[false] then raise exception 'Foreign dashboard channel was subscribable'; end if;
  select read_allowed into allowed from realtime.authorize('authenticated',topic_a,'{"role":"authenticated","sub":"progress-test"}','progress-test','{}',array['broadcast'],array[]::text[]);
  if allowed is distinct from array[false] then raise exception 'Missing organization allowed a subscription'; end if;
end $verify$;
rollback;
