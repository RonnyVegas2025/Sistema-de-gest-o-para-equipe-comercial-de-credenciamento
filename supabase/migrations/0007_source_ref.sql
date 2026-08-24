-- 0007_source_ref.sql — Sprint 1, etapa 7
--
-- `source_ref` nas quatro entidades da estrutura comercial, com índice único
-- parcial sobre não nulos. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ---------------------------------------------------------------------------
-- O QUE É `source_ref` E POR QUE ELE EXISTE (D-004)
--
-- O Painel ADM é a fonte de verdade de directors, managers, teams e sellers. O
-- CRM os carrega por importação. Como são bancos separados (D-001), o `id` do
-- CRM não é o `id` da origem — e sem uma chave estável, reimportar depois de uma
-- pessoa mudar de nome criaria um registro duplicado.
--
-- `source_ref` guarda o UUID da linha no Painel. A exportação da origem inclui a
-- coluna `id`, e é ela que vem para cá.
--
-- POR QUE NÃO DEDUPLICAR POR NOME. A spec de importação de vendedores da origem
-- casa por nome normalizado, e o próprio código de lá assume que "vendedor não
-- tem chave natural única". Isso basta onde há uma fonte só; não basta para
-- replicação entre bancos, e o nome é rótulo, não identidade — homônimo colide,
-- casamento muda sobrenome, e a correção de um erro de digitação viraria pessoa
-- nova.
--
-- ---------------------------------------------------------------------------
-- POR QUE O ÍNDICE É PARCIAL, sobre `where source_ref is not null`
--
-- Registro nascido no CRM não veio de importação: seu `source_ref` é nulo. Um
-- índice único comum trataria nulos como distintos entre si no Postgres, então
-- funcionaria — mas o parcial declara a intenção e evita indexar linhas que
-- nunca serão consultadas por essa chave.
--
-- Duas linhas com `source_ref` nulo convivem. Duas com o MESMO `source_ref` não:
-- seria a mesma pessoa da origem importada duas vezes, que é exatamente o que a
-- chave existe para impedir.
-- ---------------------------------------------------------------------------

alter table public.directors add column if not exists source_ref text;
alter table public.managers  add column if not exists source_ref text;
alter table public.teams     add column if not exists source_ref text;
alter table public.sellers   add column if not exists source_ref text;

create unique index if not exists directors_source_ref_unique
  on public.directors (source_ref) where source_ref is not null;
create unique index if not exists managers_source_ref_unique
  on public.managers (source_ref) where source_ref is not null;
create unique index if not exists teams_source_ref_unique
  on public.teams (source_ref) where source_ref is not null;
create unique index if not exists sellers_source_ref_unique
  on public.sellers (source_ref) where source_ref is not null;

comment on column public.directors.source_ref is
  'UUID da linha correspondente no Painel ADM (D-004). Nulo em registro nascido no CRM. Chave de deduplicação da importação — nunca o nome.';
comment on column public.managers.source_ref is
  'UUID da linha correspondente no Painel ADM (D-004). Nulo em registro nascido no CRM. Chave de deduplicação da importação — nunca o nome.';
comment on column public.teams.source_ref is
  'UUID da linha correspondente no Painel ADM (D-004). Nulo em registro nascido no CRM. Chave de deduplicação da importação — nunca o nome.';
comment on column public.sellers.source_ref is
  'UUID da linha correspondente no Painel ADM (D-004). Nulo em registro nascido no CRM. Chave de deduplicação da importação — nunca o nome.';
