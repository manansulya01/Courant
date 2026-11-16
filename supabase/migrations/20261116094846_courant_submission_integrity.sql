drop policy if exists "submissions_update_own_or_teaching" on public.assignment_submissions;
create policy "submissions_update_own_or_teaching" on public.assignment_submissions
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
)
with check (
  (
    user_id = (select auth.uid())
    and status = 'submitted'
    and score is null
    and feedback is null
    and reviewed_by is null
    and exists (
      select 1 from public.assignments a
      join public.class_members m on m.class_id = a.class_id
      where a.id = assignment_id and m.student_id = (select auth.uid())
    )
  )
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
);

create or replace function public.guard_submission_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assignment_id <> old.assignment_id or new.user_id <> old.user_id then
    raise exception 'Submission owner and assignment cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_submission_identity_trigger on public.assignment_submissions;
create trigger guard_submission_identity_trigger
before update on public.assignment_submissions
for each row execute procedure public.guard_submission_identity();

drop policy if exists "assignments_teacher_update" on public.assignments;
create policy "assignments_teacher_update" on public.assignments
for update to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid()))
);
