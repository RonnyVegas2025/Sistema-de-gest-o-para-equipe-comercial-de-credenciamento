-- 0015_visao_origem_comercio.sql — Sprint 2, etapa 5c
--
-- View de leitura para a página "Novos Comércios": um comércio por linha, no
-- escopo de quem pergunta, já dizendo se ele tem origem de demanda registrada.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ===========================================================================
-- POR QUE UMA VIEW, e por que ela não estava no plano
--
-- O plano da etapa 5c dizia "migration: nenhuma". Estava errado, e o limite
-- apareceu construindo.
--
-- O indicador de exceção da página é um contador de comércios SEM origem — que
-- é um `NOT EXISTS` sobre `crm_accreditation_demands`, atravessando o
-- relacionamento. Pelo PostgREST isso exigiria filtro de nulo sobre recurso
-- ANINHADO (relacionamento → companies → demandas), forma que não temos como
-- exercitar deste projeto.
--
-- As saídas sem migration eram piores, e todas do mesmo jeito:
--
--   contar sobre a página carregada   conta a página, não o conjunto
--   trazer tudo e contar no cliente   mata a paginação
--   confiar na forma aninhada         número plausível e errado se não valer
--
-- Contador que mente é pior que contador ausente: ninguém confere um número que
-- parece razoável. E dar o contador só à gestão o transformaria em relatório de
-- auditoria — ele existe para quem cadastra ver o que ficou sem origem.
--
-- ===========================================================================
-- `security_invoker = true` É O MECANISMO, NÃO UM DETALHE
--
-- View comum no Postgres roda com os privilégios de QUEM A CRIOU. Como as
-- migrations são aplicadas pelo dono, uma view sem esta opção **atravessaria a
-- RLS de todas as tabelas de baixo** e devolveria a base inteira para qualquer
-- consultor — um furo de escopo que nada na tela denunciaria, porque a tela
-- mostraria exatamente o que a view devolvesse.
--
-- Com `security_invoker = true`, a view é avaliada com os privilégios e as
-- policies de QUEM CONSULTA. O recorte de `crm_company_relationships` (0013) e
-- o recorte transitivo de `crm_accreditation_demands` (0014) continuam valendo
-- — a view não ganha poder nenhum, só dá forma ao que a pessoa já podia ler.
--
-- Isso vale inclusive para o `exists` do `tem_origem`: ele é avaliado sob a
-- policy da demanda, então a coluna responde "tem origem QUE EU POSSO VER", que
-- é a leitura certa para um contador que precisa bater com a lista ao lado.
--
-- **O Security Advisor do Supabase provavelmente vai apontar esta view.** O
-- lint dele mira view `security definer` — que é o oposto do que está aqui.
-- Conferir o `reloptions` antes de "corrigir": remover esta linha é abrir o
-- furo, não fechá-lo. Mesma natureza da exceção documentada das funções de
-- trilha (D-023).
--
-- ===========================================================================
-- O QUE ELA NÃO É
--
-- Não é fonte de verdade nem cria conceito novo: é projeção de leitura sobre
-- `crm_company_relationships` + `companies` + `crm_accreditation_demands`.
-- Nenhuma coluna nova, nenhum estado guardado, nenhuma escrita.
--
-- Não inclui comércio SEM relacionamento. Isso é consequência da policy de
-- 0013, não escolha da view: para a gestão ele aparece (o ramo de gestão da
-- policy o alcança), e para o consultor não — distribuir é ação de gestão
-- (RLS_PERMISSOES §5.3). A página trata essa população num contador próprio.
-- ===========================================================================

drop view if exists public.crm_merchant_origin_status;

create view public.crm_merchant_origin_status
with (security_invoker = true) as
select
  r.id                    as relationship_id,
  r.company_id,
  r.responsible_seller_id,
  r.team_id,
  r.relationship_type,
  r.relationship_started_at,
  r.ended_at,
  r.status                as relationship_status,
  c.legal_name,
  c.trade_name,
  c.cnpj,
  c.municipio,
  c.uf,
  c.status                as company_status,
  c.created_at            as company_created_at,
  -- Avaliado sob a policy da demanda: "tem origem que eu posso ver".
  exists (
    select 1
      from public.crm_accreditation_demands d
     where d.merchant_company_id = r.company_id
  )                       as tem_origem
from public.crm_company_relationships r
join public.companies c on c.id = r.company_id
where c.is_merchant;

comment on view public.crm_merchant_origin_status is
  'Comércios no escopo de quem consulta, com tem_origem calculado sob a policy da demanda. security_invoker=true é o mecanismo de recorte — removê-lo abre furo de escopo (0015, D-042).';

-- Sem grant explícito: no projeto hospedado `anon`/`authenticated` já recebem
-- privilégio sobre as relações de `public` pelo bootstrap do Supabase, e no
-- cluster local o mesmo vem de `supabase/dev/02_harness_grants.sql`, que define
-- `alter default privileges`. Conceder aqui à mão criaria uma segunda regra,
-- divergente da do painel.
