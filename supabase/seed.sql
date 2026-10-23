-- Development fixtures only. These are example states, not parser output.
-- Replace these two Clerk organization IDs when using another development instance.
begin;
insert into public.organizations (id) values
  ('org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3'),
  ('org_3L6JhE5FMx3d0XMwt3oDSIoKav0')
on conflict (id) do nothing;

insert into public.projects (organization_id, repository_url) values
  ('org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3', 'https://github.com/vercel/next.js'),
  ('org_3L6JhE5FMx3d0XMwt3oDSIoKav0', 'https://github.com/supabase/supabase')
on conflict (organization_id, repository_url) do nothing;

insert into public.analyses (organization_id, project_id, status)
select p.organization_id, p.id, fixture.status
from public.projects p
cross join (values ('queued'), ('running'), ('completed'), ('failed')) as fixture(status)
where (p.organization_id, p.repository_url) in (
  ('org_3L6Gcqg29P2e9kQWc44v2Hv7Uf3', 'https://github.com/vercel/next.js'),
  ('org_3L6JhE5FMx3d0XMwt3oDSIoKav0', 'https://github.com/supabase/supabase')
)
and not exists (
  select 1 from public.analyses a
  where a.organization_id = p.organization_id and a.project_id = p.id and a.status = fixture.status
);
commit;
