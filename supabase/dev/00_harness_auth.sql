-- Emulação mínima do que o Supabase provê e as migrations assumem.
--
-- NÃO é parte do schema da aplicação e NUNCA é aplicado no projeto hospedado:
-- lá tudo isto já existe, criado pelo próprio Supabase. Serve só ao cluster
-- local de teste, para que `supabase/migrations/` possa ser aplicado do zero.
--
-- O que está aqui é o contrato de que as migrations dependem — e vale ser
-- explícito, porque dependência não declarada é a que quebra na reconstrução:
--
--   auth.users            0001 referencia com FK e pendura trigger
--   auth.uid()            33 usos, em policies e funções de escopo
--   anon / authenticated  alvos de grant e revoke
--   service_role          existe por simetria com o projeto real
--
-- `auth.uid()` reproduz a implementação do Supabase, inclusive a ordem: primeiro
-- `request.jwt.claim.sub`, depois o `sub` de `request.jwt.claims`. Os testes
-- usam a primeira forma; manter as duas evita que um teste passe aqui por um
-- caminho que não existe lá.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Só as colunas que as migrations tocam. Acrescentar campo aqui só quando uma
-- migration passar a depender dele — espelho grande esconde dependência nova.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_user::text
  )
$$;

grant select on auth.users to authenticated, service_role;
