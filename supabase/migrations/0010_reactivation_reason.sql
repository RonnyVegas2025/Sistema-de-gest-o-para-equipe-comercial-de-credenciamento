-- 0010_reactivation_reason.sql — Sprint 1, correção pós-revisão
--
-- Separa o motivo da reativação do motivo da inativação. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA MIGRATION EXISTE (D-033, emenda a D-025)
--
-- D-025 exige motivo nos dois sentidos da transição, mas não dizia onde o motivo
-- da REATIVAÇÃO mora. A 0008 reusou `inactivation_reason` para ambos,
-- transformando-a em "motivo da transição mais recente".
--
-- Isso é ambíguo por construção. A coluna precisa responder POR QUE ESTE
-- REGISTRO ESTÁ INATIVO — não o que aconteceu por último. Num registro
-- reativado, o campo único passaria a explicar por que ele está ATIVO, enquanto
-- o nome promete o contrário, e quem o lesse receberia a informação errada sem
-- nenhum sinal disso.
--
-- A 0008 não é editada (D-021). Esta é a correção.
--
-- Divisão final:
--   inactivation_reason   por que está inativo   — preenchido em ativo→inativo
--   reactivation_reason   por que voltou         — preenchido em inativo→ativo,
--                                                  limpo na próxima inativação
--   inactivated_at/_by    quando e por quem      — só o banco escreve
--
-- A trilha em crm_record_status_history continua guardando os dois eventos com
-- seus motivos próprios em `reason`. As colunas são o ESTADO CORRENTE; a trilha
-- é o histórico.
-- ---------------------------------------------------------------------------

alter table public.directors add column if not exists reactivation_reason text;
alter table public.managers  add column if not exists reactivation_reason text;
alter table public.teams     add column if not exists reactivation_reason text;
alter table public.sellers   add column if not exists reactivation_reason text;

comment on column public.directors.inactivation_reason is
  'Por que este registro está inativo. Informado pela operação na transição ativo→inativo; permanece como histórico do estado.';
comment on column public.managers.inactivation_reason is
  'Por que este registro está inativo. Informado pela operação na transição ativo→inativo; permanece como histórico do estado.';
comment on column public.teams.inactivation_reason is
  'Por que este registro está inativo. Informado pela operação na transição ativo→inativo; permanece como histórico do estado.';
comment on column public.sellers.inactivation_reason is
  'Por que este registro está inativo. Informado pela operação na transição ativo→inativo; permanece como histórico do estado.';

comment on column public.directors.reactivation_reason is
  'Por que este registro voltou à circulação. Informado pela operação na transição inativo→ativo; limpo na próxima inativação.';
comment on column public.managers.reactivation_reason is
  'Por que este registro voltou à circulação. Informado pela operação na transição inativo→ativo; limpo na próxima inativação.';
comment on column public.teams.reactivation_reason is
  'Por que este registro voltou à circulação. Informado pela operação na transição inativo→ativo; limpo na próxima inativação.';
comment on column public.sellers.reactivation_reason is
  'Por que este registro voltou à circulação. Informado pela operação na transição inativo→ativo; limpo na próxima inativação.';

-- ---------------------------------------------------------------------------
-- Validação e carimbo — agora lendo a coluna certa em cada direção
--
-- Substitui a versão da 0008. Continua SEM `security definer`: valida e carimba
-- colunas da própria linha em trânsito, sem privilégio para alcançar outra
-- tabela.
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
    -- O motivo da reativação anterior deixa de valer: o registro está inativo de
    -- novo, e mantê-lo faria a linha afirmar duas coisas contraditórias.
    new.reactivation_reason := null;

  -- inativo -> ativo
  elsif new.status = 'ativo' and old.status is distinct from 'ativo' then
    if coalesce(btrim(new.reactivation_reason), '') = '' then
      raise exception 'Informe o motivo da reativação.'
        using errcode = '23514';
    end if;
    -- `inactivation_reason` NÃO é limpo: ele continua respondendo por que o
    -- registro esteve inativo, que é informação que não deixa de ser verdadeira
    -- por ele ter voltado.
    new.inactivated_at := null;
    new.inactivated_by := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções de trilha — cada uma passa a gravar o motivo da SUA direção
--
-- Uma por entidade, com o scope fixo (D-023). Assinatura inalterada:
-- security definer + search_path fixo + execute revogado de public E
-- authenticated — os dois, porque revogar só de authenticated é inócuo
-- (RLS_PERMISSOES §5.6).
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
  values ('director', old.id, old.status, new.status,
          case when new.status = 'inativo' then new.inactivation_reason
               else new.reactivation_reason end,
          auth.uid());
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
  values ('manager', old.id, old.status, new.status,
          case when new.status = 'inativo' then new.inactivation_reason
               else new.reactivation_reason end,
          auth.uid());
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
  values ('team', old.id, old.status, new.status,
          case when new.status = 'inativo' then new.inactivation_reason
               else new.reactivation_reason end,
          auth.uid());
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
  values ('seller', old.id, old.status, new.status,
          case when new.status = 'inativo' then new.inactivation_reason
               else new.reactivation_reason end,
          auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_seller() from public, authenticated;
