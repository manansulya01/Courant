drop policy if exists "profiles_update_self" on public.profiles;
revoke update on public.profiles from authenticated;
drop policy if exists "classes_teacher_all" on public.classes;
create policy "classes_teacher_select" on public.classes for select to authenticated using (teacher_id = (select auth.uid()) or exists (select 1 from public.class_members m where m.class_id = classes.id and m.student_id = (select auth.uid())));
create policy "classes_teacher_insert" on public.classes for insert to authenticated with check (teacher_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin') and p.status = 'active'));
create policy "classes_teacher_update" on public.classes for update to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin'))) with check (teacher_id = (select auth.uid()));
create policy "classes_teacher_delete" on public.classes for delete to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin')));
drop policy if exists "class_members_join_self" on public.class_members;
create or replace function public.join_class_by_code(p_code text)
returns table(class_id uuid, class_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_class public.classes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active') then
    raise exception 'Only active student accounts can join classes';
  end if;
  select * into v_class from public.classes c where c.join_code = upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if not found then raise exception 'Class code not found'; end if;
  insert into public.class_members(class_id, student_id) values (v_class.id, auth.uid()) on conflict do nothing;
  return query select v_class.id, v_class.name;
end;
$$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;
drop policy if exists "assignments_teacher_all" on public.assignments;
create policy "assignments_teacher_select" on public.assignments for select to authenticated using (teacher_id = (select auth.uid()) or exists (select 1 from public.class_members m where m.class_id = assignments.class_id and m.student_id = (select auth.uid())));
create policy "assignments_teacher_insert" on public.assignments for insert to authenticated with check (teacher_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('teacher','admin')) and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));
create policy "assignments_teacher_update" on public.assignments for update to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "assignments_teacher_delete" on public.assignments for delete to authenticated using (teacher_id = (select auth.uid()));
revoke insert, update, delete on public.class_members from authenticated;
