
create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.classes c
    join public.profiles p on p.id = c.teacher_id
    where c.id = p_class_id
      and c.teacher_id = auth.uid()
      and p.role in ('teacher', 'admin')
      and p.status = 'active'
  );
$function$;

drop policy if exists classes_teacher_select on public.classes;
create policy classes_teacher_select on public.classes
for select to authenticated
using (
  (teacher_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  ))
  or exists (
    select 1 from public.class_members m
    join public.profiles p on p.id = m.student_id
    where m.class_id = classes.id and m.student_id = (select auth.uid())
      and p.status = 'active'
  )
);

drop policy if exists classes_teacher_insert on public.classes;
create policy classes_teacher_insert on public.classes
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists classes_teacher_update on public.classes;
create policy classes_teacher_update on public.classes
for update to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists classes_teacher_delete on public.classes;
create policy classes_teacher_delete on public.classes
for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists class_members_read on public.class_members;
create policy class_members_read on public.class_members
for select to authenticated
using (
  (student_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  ))
  or public.is_teacher_of_class(class_id)
);

drop policy if exists class_members_leave_self on public.class_members;
create policy class_members_leave_self on public.class_members
for delete to authenticated
using (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student' and p.status = 'active'
  )
);

drop policy if exists assignments_teacher_select on public.assignments;
create policy assignments_teacher_select on public.assignments
for select to authenticated
using (
  (teacher_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  ))
  or exists (
    select 1 from public.class_members m
    join public.profiles p on p.id = m.student_id
    where m.class_id = assignments.class_id and m.student_id = (select auth.uid())
      and p.role = 'student' and p.status = 'active'
  )
);

drop policy if exists assignments_teacher_insert on public.assignments;
create policy assignments_teacher_insert on public.assignments
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
  and exists (
    select 1 from public.classes c
    where c.id = assignments.class_id and c.teacher_id = (select auth.uid())
  )
);

drop policy if exists assignments_teacher_update on public.assignments;
create policy assignments_teacher_update on public.assignments
for update to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
  and exists (
    select 1 from public.classes c
    where c.id = assignments.class_id and c.teacher_id = (select auth.uid())
  )
);

drop policy if exists assignments_teacher_delete on public.assignments;
create policy assignments_teacher_delete on public.assignments
for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists submissions_delete_own on public.assignment_submissions;
create policy submissions_delete_own on public.assignment_submissions
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
);

drop policy if exists submissions_insert_own_enrolled on public.assignment_submissions;
create policy submissions_insert_own_enrolled on public.assignment_submissions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student' and p.status = 'active'
  )
  and exists (
    select 1 from public.assignments a
    join public.class_members m on m.class_id = a.class_id
    where a.id = assignment_submissions.assignment_id and m.student_id = (select auth.uid())
  )
);

drop policy if exists submissions_read_own_or_teaching on public.assignment_submissions;
create policy submissions_read_own_or_teaching on public.assignment_submissions
for select to authenticated
using (
  (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  ))
  or exists (
    select 1 from public.assignments a
    join public.profiles p on p.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id
      and a.teacher_id = (select auth.uid())
      and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists submissions_update_own_or_teaching on public.assignment_submissions;
create policy submissions_update_own_or_teaching on public.assignment_submissions
for update to authenticated
using (
  (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student' and p.status = 'active'
  ))
  or exists (
    select 1 from public.assignments a
    join public.profiles p on p.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id
      and a.teacher_id = (select auth.uid())
      and p.role in ('teacher','admin') and p.status = 'active'
  )
)
with check (
  (
    user_id = (select auth.uid())
    and status = 'submitted'
    and score is null
    and feedback is null
    and reviewed_by is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student' and p.status = 'active'
    )
    and exists (
      select 1 from public.assignments a
      join public.class_members m on m.class_id = a.class_id
      where a.id = assignment_submissions.assignment_id and m.student_id = (select auth.uid())
    )
  )
  or exists (
    select 1 from public.assignments a
    join public.profiles p on p.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id
      and a.teacher_id = (select auth.uid())
      and p.role in ('teacher','admin') and p.status = 'active'
  )
);

drop policy if exists progress_self_all on public.learning_progress;
create policy progress_self_all on public.learning_progress
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
);

drop policy if exists portfolio_self_all on public.portfolio_items;
create policy portfolio_self_all on public.portfolio_items
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  )
);

drop policy if exists reset_tokens_self_read on public.password_reset_tokens;
revoke all on table public.password_reset_tokens, public.api_rate_limits, public.api_internal_secrets, public.teacher_invites from anon, authenticated;
