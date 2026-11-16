drop policy if exists "classes_student_read" on public.classes;
drop policy if exists "assignments_student_read" on public.assignments;
drop policy if exists "submissions_student_all" on public.assignment_submissions;
drop policy if exists "submissions_teacher_read" on public.assignment_submissions;
drop policy if exists "submissions_teacher_review" on public.assignment_submissions;

create policy "submissions_read_own_or_teaching" on public.assignment_submissions
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
);
create policy "submissions_insert_own_enrolled" on public.assignment_submissions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.assignments a
    join public.class_members m on m.class_id = a.class_id
    where a.id = assignment_id and m.student_id = (select auth.uid())
  )
);
create policy "submissions_update_own_or_teaching" on public.assignment_submissions
for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = (select auth.uid()))
);
create policy "submissions_delete_own" on public.assignment_submissions
for delete to authenticated
using (user_id = (select auth.uid()));

create index if not exists submissions_reviewed_by_idx on public.assignment_submissions(reviewed_by);
