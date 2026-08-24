-- 0008_trilha_cadastral.sql — Sprint 1, etapa 8
--
-- Trilha cadastral: crm_record_status_history, colunas de inativação nas quatro
-- entidades, UMA função de trilha por entidade, e o enforcement de reativação.
-- Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- POR QUE ANTES DA 0009. As entidades da etapa 6 já admitem inativação. Trilha
-- que nasce depois do dado nasce incompleta: toda inativação ocorrida no
-- intervalo fica sem registro, e não há como reconstruí-la.

-- ---------------------------------------------------------------------------
-- 1. Tabela de trilha
--
-- `scope` restrito por CHECK e `target_id` not null: sem isso, uma linha órfã ou
-- com escopo inventado passaria despercebida numa tabela que ninguém edita.
--
-- Distinta de crm_opportunity_status_history, que registra funil comercial.
-- Inativar por erro cadastral e perder uma negociação são eventos de natureza
-- diferente; misturá-los faria o funil contabilizar correções administrativas.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_record_status_history (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null check (scope in (
                    'company', 'director', 'manager', 'team', 'seller',
                    'relationship', 'contact', 'product', 'loss_reason',
                    'portfolio', 'portfolio_company', 'opportunity'
                  )),
  target_id       uuid not null,
  previous_status public.entity_status not null,
  new_status      public.entity_status not null,
  reason          text,
  changed_by      uuid references public.profiles (id) default auth.uid(),
  changed_at      timestamptz not null default now()
);

create index if not exists crm_record_status_hist_target_idx
  on public.crm_record_status_history (scope, target_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 2. Colunas de inativação nas quatro entidades (D-025)
--
-- Divisão de responsabilidade, que é o ponto:
--   inactivation_reason  vem da OPERAÇÃO, validado pela trigger
--   inactivated_at       definido EXCLUSIVAMENTE pelo banco — now()
--   inactivated_by       definido EXCLUSIVAMENTE pelo banco — auth.uid()
--
-- Sem motivo, meses depois ninguém distingue "cadastro duplicado" de "criei sem
-- querer" de "não sei por que está assim". A distinção importa porque inativação
-- é reservada a ERRO CADASTRAL: se o motivo registrado descrever uma conclusão
-- de negócio, a operação foi feita no campo errado.
-- ---------------------------------------------------------------------------
alter table public.directors
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references public.profiles (id),
  add column if not exists inactivation_reason text;
alter table public.managers
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references public.profiles (id),
  add column if not exists inactivation_reason text;
alter table public.teams
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references public.profiles (id),
  add column if not exists inactivation_reason text;
alter table public.sellers
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references public.profiles (id),
  add column if not exists inactivation_reason text;

comment on column public.directors.inactivation_reason is
  'Motivo da transição de status MAIS RECENTE, informado pela operação. A trilha em crm_record_status_history guarda todas; esta coluna guarda a última.';
comment on column public.managers.inactivation_reason is
  'Motivo da transição de status MAIS RECENTE, informado pela operação. A trilha em crm_record_status_history guarda todas; esta coluna guarda a última.';
comment on column public.teams.inactivation_reason is
  'Motivo da transição de status MAIS RECENTE, informado pela operação. A trilha em crm_record_status_history guarda todas; esta coluna guarda a última.';
comment on column public.sellers.inactivation_reason is
  'Motivo da transição de status MAIS RECENTE, informado pela operação. A trilha em crm_record_status_history guarda todas; esta coluna guarda a última.';

-- ---------------------------------------------------------------------------
-- 3. Validação e carimbo da transição de status
--
-- Função COMPARTILHADA, e isso não contraria D-023. A regra de "uma função por
-- entidade" existe porque um GRAVADOR genérico de histórico — capaz de inserir
-- qualquer scope com qualquer target_id — anularia a imutabilidade, bastando
-- chamá-lo com os argumentos certos. Esta função não grava histórico: ela valida
-- e carimba colunas da PRÓPRIA linha em trânsito, sem `security definer` e sem
-- privilégio para alcançar outra tabela. O perigo não está na generalidade; está
-- no privilégio.
--
-- Sem sessão (SQL Editor, service role) o carimbo de autoria fica nulo, mas a
-- exigência de motivo continua valendo: um script que inativa sem dizer por quê
-- produz o mesmo buraco que a interface produziria.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- ativo -> inativo
  if new.status = 'inativo' and old.status is distinct from 'inativo' then
    if coalesce(btrim(new.inactivation_reason), '') = '' then
      raise exception 'Informe o motivo da inativação.'
        using errcode = '23514';
    end if;
    new.inactivated_at := now();
    new.inactivated_by := auth.uid();

  -- inativo -> ativo (reativação)
  elsif new.status = 'ativo' and old.status is distinct from 'ativo' then
    if coalesce(btrim(new.inactivation_reason), '') = '' then
      raise exception 'Informe o motivo da reativação.'
        using errcode = '23514';
    end if;
    -- O registro volta a circular: os carimbos de inativação são limpos. O
    -- motivo permanece na coluna como "motivo da última transição", e a trilha
    -- guarda os dois eventos com seus motivos próprios.
    new.inactivated_at := null;
    new.inactivated_by := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reativação é privilégio de administrador (D-025)
--
-- Vale MESMO onde a inativação coube ao gestor — catálogos e carteiras, nas
-- sprints seguintes. Desfazer uma decisão administrativa é ato administrativo.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_reactivation_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.status = 'ativo'
     and old.status is distinct from 'ativo'
     and not public.is_admin() then
    raise exception 'Apenas administrador pode reativar este registro.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. UMA FUNÇÃO DE TRILHA POR ENTIDADE (D-023)
--
-- Nada de gravador genérico parametrizável. Uma função capaz de inserir
-- qualquer `scope` com qualquer `target_id` anularia a imutabilidade da tabela:
-- bastaria chamá-la com os argumentos certos para forjar histórico. Cada função
-- abaixo tem o seu `scope` FIXO no corpo, e não aceita parâmetro.
--
-- Assinatura obrigatória das quatro:
--   security definer          — é o que atravessa a RLS de uma tabela sem policy
--                               de INSERT; é o mecanismo, não um atalho
--   set search_path = public  — fixo e mínimo
--   revoke execute            — de public e authenticated
--
-- O Security Advisor do Supabase vai apontar estas funções como lint por causa
-- do `security definer`. É o mecanismo. Documentar a exceção, não "corrigir".
-- ---------------------------------------------------------------------------
create or replace function public.write_record_status_director()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('director', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_director() from public, authenticated;

create or replace function public.write_record_status_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('manager', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_manager() from public, authenticated;

create or replace function public.write_record_status_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('team', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_team() from public, authenticated;

create or replace function public.write_record_status_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('seller', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_seller() from public, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Triggers
--
-- O FILTRO FICA NO `WHEN` DA DECLARAÇÃO, não dentro da função: assim a função
-- nem é chamada quando nada mudou. Sem isso, salvar a mesma tela duas vezes — ou
-- editar uma observação sem tocar no status — geraria linha de trilha idêntica.
--
-- `is distinct from`, nunca `<>`: com nulo de um dos lados, `<>` devolve nulo, o
-- trigger não dispara, e a barreira falha em silêncio.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('directors', 'director'),
      ('managers',  'manager'),
      ('teams',     'team'),
      ('sellers',   'seller')
    ) as x(tabela, escopo)
  loop
    -- validação e carimbo (BEFORE)
    execute format(
      'drop trigger if exists %I on public.%I', t.tabela || '_stamp_status', t.tabela);
    execute format(
      'create trigger %I before update on public.%I for each row
       when (old.status is distinct from new.status)
       execute function public.stamp_status_transition()',
      t.tabela || '_stamp_status', t.tabela);

    -- reativação só de administrador (BEFORE)
    execute format(
      'drop trigger if exists %I on public.%I', t.tabela || '_enforce_reactivation', t.tabela);
    execute format(
      'create trigger %I before update on public.%I for each row
       when (old.status is distinct from new.status)
       execute function public.enforce_reactivation_is_admin()',
      t.tabela || '_enforce_reactivation', t.tabela);

    -- trilha (AFTER)
    execute format(
      'drop trigger if exists %I on public.%I', t.tabela || '_record_status_history', t.tabela);
    execute format(
      'create trigger %I after update on public.%I for each row
       when (old.status is distinct from new.status)
       execute function public.write_record_status_%s()',
      t.tabela || '_record_status_history', t.tabela, t.escopo);
  end loop;
end
$$;

-- ===========================================================================
-- 7. RLS da trilha — imutável no banco (D-023)
--
--   SELECT   permitido, restrito aos escopos desta sprint
--   INSERT   NENHUMA policy — negado para todos, inclusive administrador
--   UPDATE   NENHUMA policy — negado para todos, inclusive administrador
--   DELETE   NENHUMA policy — negado para todos, inclusive administrador
--
-- A gravação acontece exclusivamente pelas funções `security definer` acima,
-- que rodam como dono da tabela e por isso atravessam a RLS. Ausência de botão
-- na interface não é imutabilidade; ausência de policy é.
--
-- NÃO habilitar `force row level security`: isso faria a RLS valer também para o
-- dono da tabela, e as próprias funções de trilha deixariam de conseguir gravar.
--
-- O SELECT é restrito aos quatro escopos desta sprint DE PROPÓSITO. Os demais
-- valores do CHECK — company, opportunity, contact, portfolio — pertencem a
-- entidades que ainda não existem e cujo recorte por escopo nasce na 0009 e nas
-- sprints seguintes. Uma leitura ampla agora ficaria aberta quando essas linhas
-- aparecessem, que é exatamente a dívida "provisória" que o sistema de origem
-- deixou correr três sprints (DE-025). Aqui a linha nova nasce invisível até
-- alguém escrever a policy dela.
-- ===========================================================================
alter table public.crm_record_status_history enable row level security;

drop policy if exists crm_record_status_history_select on public.crm_record_status_history;
create policy crm_record_status_history_select on public.crm_record_status_history
  for select
  using (
    public.auth_role() is not null
    and scope in ('director', 'manager', 'team', 'seller')
  );
