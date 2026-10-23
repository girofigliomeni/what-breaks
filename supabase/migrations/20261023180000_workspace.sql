begin;

create table public.organizations (
  id text primary key check (id <> ''),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  repository_url text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, repository_url)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  commit_sha text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects(organization_id, id) on delete cascade
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  path text not null,
  unique (organization_id, analysis_id, id),
  unique (organization_id, analysis_id, path),
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  source_file_id uuid not null,
  target_file_id uuid not null,
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, analysis_id, source_file_id) references public.files(organization_id, analysis_id, id) on delete cascade,
  foreign key (organization_id, analysis_id, target_file_id) references public.files(organization_id, analysis_id, id) on delete cascade
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  method text not null,
  path text not null,
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, analysis_id, file_id) references public.files(organization_id, analysis_id, id) on delete cascade
);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, analysis_id, file_id) references public.files(organization_id, analysis_id, id) on delete cascade
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  role text not null,
  unique (organization_id, analysis_id, file_id),
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade,
  foreign key (organization_id, analysis_id, file_id) references public.files(organization_id, analysis_id, id) on delete cascade
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, analysis_id) references public.analyses(organization_id, id) on delete cascade
);

create index analyses_organization_created_idx on public.analyses (organization_id, created_at desc, id desc);
create index analyses_project_idx on public.analyses (organization_id, project_id);
create index edges_source_idx on public.edges (organization_id, analysis_id, source_file_id);
create index edges_target_idx on public.edges (organization_id, analysis_id, target_file_id);
create index routes_file_idx on public.routes (organization_id, analysis_id, file_id);
create index explanations_file_idx on public.explanations (organization_id, analysis_id, file_id);
create index insights_analysis_idx on public.insights (organization_id, analysis_id);

-- Tables and policies become visible atomically. No browser writes are needed in this phase.
do $$
declare table_name text;
begin
  foreach table_name in array array['organizations', 'projects', 'analyses', 'files', 'edges', 'routes', 'explanations', 'file_roles', 'insights'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    -- Clerk v2 tokens nest the organization ID under o.id; older tokens use org_id.
    execute format(
      'create policy organization_read on public.%I for select to authenticated using (%I = (select coalesce(auth.jwt()->''o''->>''id'', auth.jwt()->>''org_id'')))',
      table_name, case when table_name = 'organizations' then 'id' else 'organization_id' end
    );
  end loop;
end $$;

commit;
