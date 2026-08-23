-- 0009_escopo_hierarquico.sql — Sprint 1, etapa 9
--
-- Funções de identidade e resolução de escopo. Última migration da sprint.
-- Idempotente. Aplicada DEPOIS da 0008.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ---------------------------------------------------------------------------
-- SOBRE "AS POLICIES COM RECORTE" DA ETAPA 9
--
-- A etapa pede as funções de escopo "mais as policies com recorte". As cinco
-- tabelas que recebem esse recorte — crm_company_relationships,
-- crm_opportunities, crm_activities, crm_tasks, crm_portfolio_companies
-- (RLS_PERMISSOES §5.3) — nascem da Sprint 2 em diante. NENHUMA existe hoje.
--
-- Esta migration entrega, portanto, as funções e nada de policy: não há tabela
-- onde prender o predicado. Isso NÃO é adiar o recorte — é o oposto. D-018 exige
-- que o escopo exista e esteja testado ANTES da primeira tela comercial,
-- justamente para não repetir o DE-025 da origem, onde uma leitura ampla
-- "provisória" seguia aberta três sprints depois. Aqui a função nasce pronta e
-- provada; a Sprint 2 só a pendura:
--
--     using (responsible_seller_id in (select public.scoped_seller_ids()))
--
-- O que prova a função nesta sprint é o gate de cinco usuários, que a chama
-- diretamente sob cada vínculo.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Funções de identidade
--
-- Cada uma resolve por `profile_id = auth.uid()` e `status = 'ativo'`
-- (RLS_PERMISSOES §4.1). Sem vínculo, devolvem null — e null propaga como
-- conjunto vazio no `scoped_seller_ids()`, que é o comportamento correto para
-- "usuário sem vínculo": zero linhas, sem erro.
--
-- `stable` + `security definer` + `set search_path = public`: o definer evita
-- recursão de RLS ao consultar tabelas que também têm policy. Estas três NÃO têm
-- execute revogado — as policies as chamam no contexto do usuário autenticado,
-- como `auth_role()`. O `revoke` de D-023 vale para as funções de trilha.
--
-- `limit 1`: uma pessoa não deveria ter duas linhas ativas na mesma tabela, mas
-- sem o limite o retorno escalar levantaria erro em vez de resolver. Se isso
-- acontecer, o sintoma correto é a duplicidade aparecer no cadastro, não a
-- função quebrar no meio de uma policy.
-- ---------------------------------------------------------------------------
create or replace function public.current_seller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.sellers
  where profile_id = auth.uid() and status = 'ativo'
  limit 1
$$;

create or replace function public.current_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.managers
  where profile_id = auth.uid() and status = 'ativo'
  limit 1
$$;

create or replace function public.current_director_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.directors
  where profile_id = auth.uid() and status = 'ativo'
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 2. scoped_seller_ids() — a regra inteira num lugar só
--
-- UNIÃO, NUNCA "PRIMEIRO PAPEL ENCONTRADO" (D-005). Uma pessoa pode ser diretor
-- E gestor, ou gestor E vendedor: as três funções de identidade podem devolver
-- valor simultaneamente para o mesmo auth.uid(), e os conjuntos se somam.
--
-- Não é hipótese. DE-035 do sistema de origem nomeia Rossi como diretor e
-- gestor, e Danilo como gestor e vendedor. Uma implementação em `case` — "se é
-- diretor, retorna isto; senão se é gestor, aquilo" — devolveria menos do que a
-- pessoa deve ver, e o sintoma seria uma carteira que some sem explicação.
--
-- O `union` (e não `union all`) deduplica: quem cai em dois ramos aparece uma
-- vez.
--
-- O caminho do gestor passa por `teams.current_manager_id`, NÃO por
-- `managers.team_id` — coluna que não existe no CRM (D-017).
--
-- Comparações com `= public.current_*_id()` são seguras quando a função devolve
-- null: `x = null` é null, o ramo não produz linhas, e quem não tem o vínculo
-- simplesmente não soma nada.
-- ---------------------------------------------------------------------------
create or replace function public.scoped_seller_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- administrador: todos os consultores ativos
  select s.id
  from public.sellers s
  where s.status = 'ativo'
    and public.is_admin()

  union

  -- consultor: apenas o próprio
  select s.id
  from public.sellers s
  where s.status = 'ativo'
    and s.id = public.current_seller_id()

  union

  -- gestor: consultores das equipes que gerencia
  select s.id
  from public.sellers s
  join public.teams t on t.id = s.team_id
  where s.status = 'ativo'
    and t.status = 'ativo'
    and t.current_manager_id = public.current_manager_id()

  union

  -- diretor: consultores das equipes dos gestores da sua diretoria
  select s.id
  from public.sellers s
  join public.teams t on t.id = s.team_id
  join public.managers m on m.id = t.current_manager_id
  where s.status = 'ativo'
    and t.status = 'ativo'
    and m.status = 'ativo'
    and m.director_id = public.current_director_id()
$$;

comment on function public.scoped_seller_ids() is
  'Conjunto de sellers.id no alcance do usuário. UNIÃO dos vínculos, nunca o primeiro papel encontrado (D-005). Usar como: using (coluna in (select public.scoped_seller_ids())).';
