create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := 'student';
  v_code text := nullif(trim(new.raw_user_meta_data->>'teacher_invite_code'), '');
  v_hash text;
begin
  if v_code is not null and length(v_code) <= 100 then
    delete from public.teacher_invites
      where code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
        and expires_at > now()
        and redeemed_at is null
      returning code_hash into v_hash;
    if v_hash is not null then v_role := 'teacher'; end if;
  end if;
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), lower(new.email), v_role)
  on conflict (id) do update set email = excluded.email, name = excluded.name;
  return new;
end;
$$;
create or replace function public.check_teacher_invite(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_code is not null
    and length(p_code) <= 100
    and exists (
      select 1 from public.teacher_invites i
      where i.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
        and i.expires_at > now()
        and i.redeemed_at is null
    );
$$;
revoke all on function public.check_teacher_invite(text) from public;
grant execute on function public.check_teacher_invite(text) to anon, authenticated;
