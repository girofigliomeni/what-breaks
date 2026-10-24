-- Supabase grants authenticated execution on new public functions by default.
-- Completion belongs exclusively to the server writer.
revoke execute on function public.complete_analysis_run(uuid, jsonb, uuid) from authenticated;
