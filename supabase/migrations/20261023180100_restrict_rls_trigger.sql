-- The existing ensure_rls event trigger still runs as its owner; API roles
-- must not be able to invoke its privileged function.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
