drop function if exists public.consume_rate_limit(text,integer,integer);
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer, p_secret text)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_now timestamptz := clock_timestamp();
 v_row public.api_rate_limits%rowtype;
 v_reset timestamptz;
 v_scope text := split_part(coalesce(p_key,''), ':', 1);
 v_expected_limit integer;
 v_expected_window integer;
 v_expected_hash text;
begin
 select secret_hash into v_expected_hash from public.api_internal_secrets where name='rate_limit_rpc';
 if p_secret is null or length(p_secret) <> 64 or v_expected_hash is null
    or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_expected_hash then
   raise exception 'Invalid rate limit credential';
 end if;
 case v_scope
  when 'auth-login' then v_expected_limit:=8; v_expected_window:=60;
  when 'auth-register' then v_expected_limit:=5; v_expected_window:=60;
  when 'password-reset-request' then v_expected_limit:=5; v_expected_window:=3600;
  when 'password-reset' then v_expected_limit:=8; v_expected_window:=3600;
  when 'class-join' then v_expected_limit:=8; v_expected_window:=60;
  when 'assignment-submit' then v_expected_limit:=20; v_expected_window:=60;
  when 'submission-review' then v_expected_limit:=40; v_expected_window:=60;
  when 'teacher-write' then v_expected_limit:=40; v_expected_window:=60;
  when 'teacher-delete' then v_expected_limit:=40; v_expected_window:=60;
  when 'progress-write' then v_expected_limit:=60; v_expected_window:=60;
  when 'portfolio-write' then v_expected_limit:=40; v_expected_window:=60;
  when 'coach' then v_expected_limit:=30; v_expected_window:=60;
  when 'tutor' then v_expected_limit:=30; v_expected_window:=60;
  when 'realtime-session' then v_expected_limit:=8; v_expected_window:=60;
  when 'speech' then v_expected_limit:=30; v_expected_window:=60;
  when 'transcribe' then v_expected_limit:=15; v_expected_window:=60;
  when 'avatar-token' then v_expected_limit:=4; v_expected_window:=60;
  when 'account-delete' then v_expected_limit:=3; v_expected_window:=3600;
  else raise exception 'Unknown rate limit scope';
 end case;
 if p_key is null or length(p_key) > 180 or p_key !~ ('^' || v_scope || ':[0-9a-f]{32}$')
    or p_limit <> v_expected_limit or p_window_seconds <> v_expected_window then
   raise exception 'Invalid rate limit arguments';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
 select * into v_row from public.api_rate_limits where key = p_key for update;
 if not found or v_row.expires_at <= v_now then
   v_reset := v_now + make_interval(secs => p_window_seconds);
   insert into public.api_rate_limits(key,count,window_started_at,expires_at)
   values(p_key,1,v_now,v_reset)
   on conflict(key) do update set count=1,window_started_at=v_now,expires_at=v_reset;
   return query select true, 0;
   return;
 end if;
 update public.api_rate_limits set count=count+1 where key=p_key returning * into v_row;
 if random() < 0.01 then delete from public.api_rate_limits where expires_at < v_now; end if;
 return query select v_row.count <= p_limit, greatest(1,ceil(extract(epoch from (v_row.expires_at-v_now)))::integer);
end;
$$;
revoke all on function public.consume_rate_limit(text,integer,integer,text) from public;
grant execute on function public.consume_rate_limit(text,integer,integer,text) to anon, authenticated;
