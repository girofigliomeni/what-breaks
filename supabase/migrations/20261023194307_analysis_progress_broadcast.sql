begin;

-- These policies declare the allowed topic patterns before the publisher exists.
-- This Realtime version authorizes topic patterns via policies, not a channel registry.
create policy analysis_progress_receive on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and topic = (select realtime.topic())
  and exists (
    select 1 from public.analyses a
    where 'analysis:' || a.id::text = (select realtime.topic())
      and a.organization_id = coalesce((select auth.jwt())->'o'->>'id', (select auth.jwt())->>'org_id')
  )
);
create policy organization_analyses_receive on realtime.messages
for select to authenticated using (
  extension = 'broadcast'
  and topic = (select realtime.topic())
  and (select realtime.topic()) = 'organization:' ||
    coalesce((select auth.jwt())->'o'->>'id', (select auth.jwt())->>'org_id') || ':analyses'
);

create schema if not exists private;
-- Trigger-only privilege: clients cannot publish progress or call this function.
create function private.publish_analysis_progress()
returns trigger language plpgsql security definer set search_path = '' as $publish$
declare progress jsonb; message text;
begin
  if TG_OP = 'UPDATE' and
     (new.stage, new.stage_message, new.failed_stage) is not distinct from
     (old.stage, old.stage_message, old.failed_stage) then return new; end if;
  message := case when new.stage = 'failed' and new.failed_stage is not null
    then 'Failed during ' || new.failed_stage || ': ' || new.stage_message
    else new.stage_message end;
  progress := jsonb_build_object('stage',new.stage,'message',message);
  -- Insert explicitly so publication failure aborts the stage change loudly;
  -- realtime.send catches errors and could silently discard progress.
  insert into realtime.messages (topic, event, payload, private, extension) values
    ('analysis:' || new.id::text, 'progress', progress, true, 'broadcast'),
    ('organization:' || new.organization_id || ':analyses', 'progress', progress, true, 'broadcast');
  return new;
end $publish$;
revoke all on function private.publish_analysis_progress() from public, anon, authenticated;

create trigger analysis_progress
after insert or update of stage, stage_message, failed_stage on public.analyses
for each row execute function private.publish_analysis_progress();

commit;
