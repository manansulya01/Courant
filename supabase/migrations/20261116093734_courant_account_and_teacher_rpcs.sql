create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = auth.uid());
$$;
revoke all on function public.is_teacher_of_class(uuid) from public;
grant execute on function public.is_teacher_of_class(uuid) to authenticated;

drop policy if exists "class_members_read" on public.class_members;
create policy "class_members_read" on public.class_members for select to authenticated using (student_id = (select auth.uid()) or public.is_teacher_of_class(class_id));
