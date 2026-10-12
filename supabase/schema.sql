create extension if not exists pgcrypto;

create type public.app_role as enum ('student','teacher','school_admin');
create type public.session_status as enum ('in_progress','completed','abandoned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'student',
  avatar_url text,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles add constraint profiles_organization_fk
  foreign key (organization_id) references public.organizations(id) on delete set null;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  join_code text unique,
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  level text not null default 'beginner',
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  unique(course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  objective text not null default '',
  content jsonb not null default '{}'::jsonb,
  duration_minutes integer not null default 10,
  position integer not null default 0,
  unique(unit_id, position)
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  level text not null default 'beginner',
  system_prompt text not null default '',
  opening_line text not null default '',
  published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  scenario_id uuid references public.scenarios(id) on delete set null,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (lesson_id is not null or scenario_id is not null)
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  scenario_id uuid references public.scenarios(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  status public.session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer not null default 0,
  transcript text not null default '',
  audio_path text,
  feedback jsonb not null default '{}'::jsonb
);

create table public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  speaker text not null check (speaker in ('student','coach')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.skill_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete cascade,
  clarity numeric(5,2) check (clarity between 0 and 100),
  confidence numeric(5,2) check (confidence between 0 and 100),
  vocabulary numeric(5,2) check (vocabulary between 0 and 100),
  pronunciation numeric(5,2) check (pronunciation between 0 and 100),
  pace numeric(5,2) check (pace between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  content jsonb not null default '{}'::jsonb,
  recording_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_sessions_student_started_idx on public.practice_sessions(student_id, started_at desc);
create index session_messages_session_created_idx on public.session_messages(session_id, created_at);
create index assignments_class_due_idx on public.assignments(class_id, due_at);
create index skill_scores_student_created_idx on public.skill_scores(student_id, created_at desc);

create or replace function public.is_class_teacher(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.classes c where c.id = target_class and c.teacher_id = auth.uid()); $$;

create or replace function public.is_class_member(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.class_members m where m.class_id = target_class and m.student_id = auth.uid()); $$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.courses enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.scenarios enable row level security;
alter table public.assignments enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.session_messages enable row level security;
alter table public.skill_scores enable row level security;
alter table public.creator_projects enable row level security;

create policy "profiles read self" on public.profiles for select using (id = auth.uid());
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles insert self" on public.profiles for insert with check (id = auth.uid());
create policy "organization members read" on public.organizations for select using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.organization_id = organizations.id)
  or created_by = auth.uid()
);
create policy "organization creator insert" on public.organizations for insert with check (created_by = auth.uid());
create policy "class teacher or member read" on public.classes for select using (teacher_id = auth.uid() or public.is_class_member(id));
create policy "teacher creates class" on public.classes for insert with check (teacher_id = auth.uid());
create policy "teacher updates class" on public.classes for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "members read class roster" on public.class_members for select using (student_id = auth.uid() or public.is_class_teacher(class_id));
create policy "student joins class" on public.class_members for insert with check (student_id = auth.uid());
create policy "published courses visible" on public.courses for select using (published = true or created_by = auth.uid());
create policy "course creators manage" on public.courses for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "units visible with course" on public.units for select using (exists(select 1 from public.courses c where c.id = course_id and (c.published or c.created_by = auth.uid())));
create policy "lessons visible with course" on public.lessons for select using (exists(select 1 from public.units u join public.courses c on c.id = u.course_id where u.id = unit_id and (c.published or c.created_by = auth.uid())));
create policy "published scenarios visible" on public.scenarios for select using (published = true or created_by = auth.uid());
create policy "scenario creators manage" on public.scenarios for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "class assignments visible to class" on public.assignments for select using (public.is_class_teacher(class_id) or public.is_class_member(class_id));
create policy "class teacher manages assignments" on public.assignments for all using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "student owns sessions" on public.practice_sessions for select using (student_id = auth.uid());
create policy "student starts session" on public.practice_sessions for insert with check (student_id = auth.uid());
create policy "student updates session" on public.practice_sessions for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "session owner reads messages" on public.session_messages for select using (exists(select 1 from public.practice_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy "session owner writes messages" on public.session_messages for insert with check (exists(select 1 from public.practice_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy "student reads own scores" on public.skill_scores for select using (student_id = auth.uid());
create policy "student inserts own scores" on public.skill_scores for insert with check (student_id = auth.uid());
create policy "student manages own projects" on public.creator_projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'student')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();
