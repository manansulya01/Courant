create table if not exists public.api_internal_secrets (
  name text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.api_internal_secrets enable row level security;
revoke all on public.api_internal_secrets from anon, authenticated;
with generated as materialized (
  select encode(gen_random_bytes(32), 'hex') as secret
)
insert into public.api_internal_secrets(name, secret_hash)
select 'rate_limit_rpc', encode(extensions.digest(secret, 'sha256'), 'hex') from generated
on conflict(name) do nothing;
