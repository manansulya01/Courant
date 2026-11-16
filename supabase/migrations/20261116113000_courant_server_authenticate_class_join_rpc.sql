drop function if exists public.join_class_by_code(text);
create function public.join_class_by_code(p_code text, p_secret text)
returns table(class_id uuid, class_name text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_class public.classes%rowtype;
  v_expected_hash text;
  v_code text := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
begin
  select secret_hash into v_expected_hash
  from public.api_internal_secrets
  where name = 'rate_limit_rpc';

  if p_secret is null or length(p_secret) <> 64 or v_expected_hash is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid class join credential';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(v_code) < 4 or length(v_code) > 12 then
    raise exception 'Invalid class code';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.status = 'active'
  ) then
    raise exception 'Only active student accounts can join classes';
  end if;

  select * into v_class
  from public.classes c
  where c.join_code = v_code;

  if not found then
    raise exception 'Class code not found';
  end if;

  insert into public.class_members(class_id, student_id)
  values (v_class.id, auth.uid())
  on conflict do nothing;

  return query select v_class.id, v_class.name;
end;
$function$;

revoke all on function public.join_class_by_code(text, text) from public, anon;
grant execute on function public.join_class_by_code(text, text) to authenticated;
