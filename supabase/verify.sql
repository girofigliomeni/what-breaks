-- Run as the database owner. Every assertion fails loudly; changes roll back.
begin;
do $$
declare
  table_name text;
  claim text;
  unexpected bigint;
  secured_count integer;
begin
  select count(*) into secured_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array['organizations','projects','analyses','files','edges','routes','explanations','file_roles','insights'])
    and c.relrowsecurity and c.relforcerowsecurity;
  if secured_count <> 9 then raise exception 'Expected RLS on all nine tables, got %', secured_count; end if;

  foreach claim in array array[
    '{"role":"authenticated","o":{"id":"org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3"}}',
    '{"role":"authenticated","o":{"id":"org_3L6JhE5FMx3d0XMwt3oDSIoKav0"}}',
    '{"role":"authenticated","org_id":"org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3"}',
    '{"role":"authenticated"}'
  ] loop
    perform set_config('request.jwt.claims', claim, true);
    set local role authenticated;
    foreach table_name in array array['organizations','projects','analyses','files','edges','routes','explanations','file_roles','insights'] loop
      execute format(
        'select count(*) from public.%I where %I is distinct from coalesce(auth.jwt()->''o''->>''id'', auth.jwt()->>''org_id'')',
        table_name, case when table_name = 'organizations' then 'id' else 'organization_id' end
      ) into unexpected;
      if unexpected <> 0 then raise exception 'Organization isolation failed for %', table_name; end if;
    end loop;
    if coalesce(auth.jwt()->'o'->>'id', auth.jwt()->>'org_id') is not null then
      select count(*) into unexpected from public.analyses;
      if unexpected <> 4 then raise exception 'Expected four seeded analyses, got %', unexpected; end if;
    end if;
    reset role;
  end loop;

  -- Deleting a parent must remove its project and analysis, not orphan them.
  insert into public.organizations(id) values ('cascade-verification');
  insert into public.projects(organization_id, repository_url) values ('cascade-verification', 'https://github.com/example/fixture');
  insert into public.analyses(organization_id, project_id)
    select organization_id, id from public.projects where organization_id = 'cascade-verification';
  delete from public.organizations where id = 'cascade-verification';
  if exists (select 1 from public.projects where organization_id = 'cascade-verification')
    or exists (select 1 from public.analyses where organization_id = 'cascade-verification') then
    raise exception 'Organization cascade failed';
  end if;
end $$;
rollback;
