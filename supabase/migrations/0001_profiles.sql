-- 0001_profiles.sql — Sprint 1, etapa 6
--
-- Enum app_role, tabela profiles, funções de apoio, triggers e RLS.
--
-- Idempotente: pode ser reaplicada sem erro. A seção de RLS ao final espelha
-- supabase/policies/profiles.sql — o espelho é a referência por domínio, e a
-- sincronia entre os dois é manual.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031). O banco não guarda
-- histórico de migrations; o repositório é a única fonte da ordem aplicada.

-- ---------------------------------------------------------------------------
-- 1. Enum de perfis
--
-- Enum e não tabela: a lista muda com mudança de arquitetura, não de operação
-- (MODELO_DADOS §1.1). Não existe papel `diretor` — diretor é `gestor_adm` cujo
-- vínculo em `directors` resolve para a diretoria inteira (D-005).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'administrador',
      'gestor_adm',
      'analista_adm',
      'comercial',
      'financeiro',
      'auditoria'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabela profiles
--
-- Espelho de auth.users com o que a aplicação precisa. `id` referencia
-- auth.users com on delete cascade: apagar o usuário no Auth não deixa perfil
-- órfão.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text not null,
  role       public.app_role not null default 'auditoria',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices das colunas usadas em policy e em filtro de listagem administrativa.
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_active_idx on public.profiles (is_active);

-- ---------------------------------------------------------------------------
-- 3. Funções de apoio
--
-- Definidas antes dos triggers e das policies, que dependem delas.
--
-- `auth_role` e não `current_role`: este último colide com a função interna do
-- Postgres.
--
-- `security definer` + `stable` evitam recursão de RLS ao consultar profiles de
-- dentro da própria policy da tabela profiles. `set search_path = public` fixa
-- a resolução de nomes — sem isso, um search_path manipulado mudaria qual
-- objeto a função enxerga.
--
-- NÃO se revoga execute destas três: as policies as chamam no contexto do
-- usuário autenticado. O `revoke execute` de D-023 vale para as funções de
-- trilha, que só a trigger deve poder chamar.
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = 'administrador'
$$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = any (roles)
$$;

-- ---------------------------------------------------------------------------
-- 4. updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Criação do profile ao inserir usuário em auth.users
--
-- O perfil SEMPRE nasce como 'auditoria', o menos privilegiado. A promoção é
-- ato explícito de administrador e não vem de `raw_user_meta_data` — caso
-- contrário quem controlasse o metadata do cadastro escolheria o próprio papel.
--
-- `full_name` vem do metadata quando existe, com o e-mail como fallback: sem
-- isso o perfil nasceria com o e-mail no lugar do nome.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. Proteção do próprio perfil
--
-- A policy de UPDATE autoriza o administrador a editar qualquer linha e o
-- usuário a editar a própria. É ESTE trigger que restringe QUAIS colunas mudam:
--
--   - ninguém altera o próprio role nem o próprio is_active, administrador
--     incluído — senão o gate de papel seria contornável pelo próprio usuário;
--   - e-mail só administrador altera, porque auth.users.email é a fonte de
--     verdade e a divergência quebraria listagens e recuperação de senha.
--
-- Sem sessão (SQL Editor, service role, scripts) o trigger não bloqueia: é como
-- a Edge Function admin-create-user define o papel do usuário recém-criado.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_profile_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sem sessão de usuário: SQL Editor, service role, seed, manutenção.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.id
     and (new.role is distinct from old.role
          or new.is_active is distinct from old.is_active) then
    raise exception 'Alteração do próprio role/is_active não é permitida.'
      using errcode = '42501';
  end if;

  if new.email is distinct from old.email
     and public.auth_role() is distinct from 'administrador' then
    raise exception 'Alteração de e-mail não é permitida para este perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_profile_tampering on public.profiles;
create trigger profiles_prevent_profile_tampering
  before update on public.profiles
  for each row
  execute function public.prevent_profile_tampering();

-- ===========================================================================
-- 7. RLS e políticas — espelho de supabase/policies/profiles.sql
-- ===========================================================================
alter table public.profiles enable row level security;

-- SELECT: a própria linha; administrador lê todas (RLS_PERMISSOES §5.1).
--
-- DIVERGE DA ORIGEM DE PROPÓSITO. Lá a policy inclui `gestor_adm`, o que é mais
-- amplo que a matriz §3 (`usuarios.read = [administrador]`) — divergência que o
-- próprio sistema de origem registra e não reconciliou. Aqui a policy segue a
-- matriz.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_admin()
  );

-- UPDATE: a própria linha ou administrador. O trigger acima restringe colunas.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- INSERT e DELETE: nenhuma policy, portanto negados para todos via API.
-- profiles nasce pelo trigger handle_new_user; saída de circulação é
-- is_active = false, nunca DELETE.
