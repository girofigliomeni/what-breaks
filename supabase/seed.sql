-- Development organizations/projects only. Analyses now come from real runs.
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

commit;
