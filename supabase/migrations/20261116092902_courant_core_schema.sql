create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  role text not null default 'student' check (role in ('student','teacher','parent','admin')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  instructions text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null default '',
  content text not null check (char_length(content) between 1 and 12000),
  status text not null default 'submitted' check (status in ('submitted','reviewed')),
  feedback text,
  score numeric(5,2) check (score is null or score between 0 and 100),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null,
  status text not null default 'in_progress',
  score numeric(6,2),
  data jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_idx on public.classes(teacher_id, created_at desc);
create index if not exists class_members_student_idx on public.class_members(student_id, joined_at desc);
create index if not exists assignments_teacher_idx on public.assignments(teacher_id, created_at desc);
create index if not exists assignments_class_idx on public.assignments(class_id, created_at desc);
create index if not exists submissions_user_idx on public.assignment_submissions(user_id, updated_at desc);
create index if not exists submissions_assignment_idx on public.assignment_submissions(assignment_id, updated_at desc);
create index if not exists progress_user_idx on public.learning_progress(user_id, updated_at desc);
create index if not exists portfolio_user_idx on public.portfolio_items(user_id, created_at desc);
create index if not exists password_reset_user_idx on public.password_reset_tokens(user_id, expires_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), lower(new.email), 'student')
  on conflict (id) do update set email = excluded.email, name = excluded.name;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.learning_progress enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.password_reset_tokens enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = (select role from public.profiles p where p.id = (select auth.uid())) and status = 'active');

create policy "classes_teacher_all" on public.classes for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "classes_student_read" on public.classes for select to authenticated using (exists (select 1 from public.class_members m where m.class_id = classes.id and m.student_id = (select auth.uid())));
create policy "class_members_read" on public.class_members for select to authenticated using (student_id = (select auth.uid()) or exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));
create policy "class_members_join_self" on public.class_members for insert to authenticated with check (student_id = (select auth.uid()));
create policy "class_members_leave_self" on public.class_members for delete to authenticated using (student_id = (select auth.uid()));

create policy "assignments_teacher_all" on public.assignments for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "assignments_student_read" on public.assignments for select to authenticated using (exists (select 1 from public.class_members m where m.class_id = assignments.class_id and m.student_id = (select auth.uid())));

create policy "submissions_student_all" on public.assignment_submissions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.class_members m join public.assignments a on a.class_id = m.class_id where a.id = assignment_id and m.student_id = (select auth.uid())));
create policy "submissions_teacher_read" on public.assignment_submissions for select to authenticated using (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid())));
create policy "submissions_teacher_review" on public.assignment_submissions for update to authenticated using (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))) with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid())));

create policy "progress_self_all" on public.learning_progress for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "portfolio_self_all" on public.portfolio_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reset_tokens_self_read" on public.password_reset_tokens for select to authenticated using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_submissions to authenticated;
grant select, insert, update, delete on public.learning_progress to authenticated;
grant select, insert, update, delete on public.portfolio_items to authenticated;
