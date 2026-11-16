create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null default 0,
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
create index if not exists api_rate_limits_expiry_idx on public.api_rate_limits(expires_at);
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare v_now timestamptz := clock_timestamp(); v_row public.api_rate_limits%rowtype; v_reset timestamptz;
begin
 if p_key is null or length(p_key) > 180 or p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
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
 return query select v_row.count <= p_limit, greatest(1,ceil(extract(epoch from (v_row.expires_at-v_now)))::integer);
end;
$$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public;
grant execute on function public.consume_rate_limit(text,integer,integer) to anon, authenticated;
