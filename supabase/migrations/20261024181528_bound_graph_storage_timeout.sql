-- Large parser payloads need time for API decoding as well as atomic storage.
-- Scope the budget to the service-only completion RPC, leaving other queries alone.
alter function public.complete_analysis_run(uuid, jsonb, uuid) set statement_timeout = '60s';
notify pgrst, 'reload schema';
