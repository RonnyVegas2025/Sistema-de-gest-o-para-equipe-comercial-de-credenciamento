-- GATE DE CINCO USUÁRIOS — Sprint 1, fechamento da etapa 9.
--
-- Somente leitura: não cria nem altera nada. Roda no SQL Editor.
--
-- ---------------------------------------------------------------------------
-- PRÉ-REQUISITO
--
-- Os cinco usuários precisam EXISTIR, com seus vínculos, antes de rodar isto.
-- Eles nascem pela Edge Function admin-create-user; os vínculos em directors,
-- managers, teams e sellers são criados à mão, porque a carga por importação
-- depende de uma exportação do Painel que ainda não existe.
--
-- Estrutura mínima que o gate pressupõe:
--
--   1 diretoria com o DIRETOR vinculado
--   2 gestores sob ela, um deles sendo o usuário GESTOR
--   1 equipe por gestor, com current_manager_id apontando para ele
--   1 consultor vinculado ao usuário CONSULTOR, numa dessas equipes
--   1 pessoa com vínculo em managers E em sellers — o usuário DUPLO
--   ao menos 1 consultor FORA da diretoria, para provar o que não se vê
--
-- ---------------------------------------------------------------------------
-- COMO USAR
--
-- Substitua os cinco UUIDs abaixo pelos `profiles.id` reais. Para descobri-los:
--
--     select id, email, role from public.profiles order by role, email;
--
-- Depois execute o arquivo inteiro e devolva a saída.
-- ---------------------------------------------------------------------------

\set admin      '00000000-0000-0000-0000-000000000000'
\set consultor  '00000000-0000-0000-0000-000000000000'
\set gestor     '00000000-0000-0000-0000-000000000000'
\set diretor    '00000000-0000-0000-0000-000000000000'
\set duplo      '00000000-0000-0000-0000-000000000000'

-- Se o seu cliente não suportar \set (o SQL Editor do painel não suporta),
-- troque cada :'variavel' abaixo pelo UUID entre aspas simples, à mão.

-- ===========================================================================
-- 1. CONSULTOR — apenas o próprio seller_id
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'consultor';
  select '1. consultor' as caso,
         public.current_seller_id() is not null as tem_vinculo_seller,
         count(*) as alcance,
         string_agg(s.full_name, ', ' order by s.full_name) as quem
  from public.sellers s where s.id in (select public.scoped_seller_ids());
rollback;

-- ===========================================================================
-- 2. GESTOR — consultores das equipes que gerencia
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'gestor';
  select '2. gestor' as caso,
         public.current_manager_id() is not null as tem_vinculo_manager,
         count(*) as alcance,
         string_agg(s.full_name, ', ' order by s.full_name) as quem
  from public.sellers s where s.id in (select public.scoped_seller_ids());
rollback;

-- ===========================================================================
-- 3. DIRETOR — consultores das equipes dos gestores sob si
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'diretor';
  select '3. diretor' as caso,
         public.current_director_id() is not null as tem_vinculo_director,
         count(*) as alcance,
         string_agg(s.full_name, ', ' order by s.full_name) as quem
  from public.sellers s where s.id in (select public.scoped_seller_ids());
rollback;

-- ===========================================================================
-- 4. ADMINISTRADOR — todos os consultores ATIVOS
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'admin';
  select '4. administrador' as caso,
         count(*) as alcance,
         (select count(*) from public.sellers where status='ativo') as total_ativos,
         count(*) = (select count(*) from public.sellers where status='ativo') as ve_todos
  from public.sellers s where s.id in (select public.scoped_seller_ids());
rollback;

-- ===========================================================================
-- 5. VÍNCULO DUPLO — A UNIÃO DOS DOIS CONJUNTOS
--
-- É O ÚNICO CASO QUE UMA IMPLEMENTAÇÃO ERRADA REPROVA. Com "primeiro papel
-- encontrado", os quatro casos acima devolvem exatamente o mesmo resultado;
-- só este cai, porque o ramo de gestor casa primeiro e o de consultor nunca
-- roda. É por isso que o quinto usuário existe (D-005 / DE-035).
--
-- `alcance` tem de ser igual a `esperado_uniao`. Se for menor, a função está
-- decidindo em vez de somar.
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'duplo';

  select '5. vínculo duplo' as caso,
         public.current_manager_id() is not null as e_gestor,
         public.current_seller_id()  is not null as e_consultor,
         count(*) as alcance,
         string_agg(s.full_name, ', ' order by s.full_name) as quem
  from public.sellers s where s.id in (select public.scoped_seller_ids());

  -- Conferência independente: os dois conjuntos calculados à mão e somados.
  select '5b. conferência da união' as caso,
         (select count(distinct x.id) from (
            select s.id from public.sellers s
             where s.status='ativo' and s.id = public.current_seller_id()
            union
            select s.id from public.sellers s
              join public.teams t on t.id = s.team_id
             where s.status='ativo' and t.status='ativo'
               and t.current_manager_id = public.current_manager_id()
         ) x) as esperado_uniao,
         (select count(*) from public.scoped_seller_ids()) as obtido_pela_funcao;
rollback;

-- ===========================================================================
-- 6. SEM VÍNCULO — conjunto vazio, SEM ERRO
--
-- Zero linhas por falta de vínculo é indistinguível de zero por falta de dados,
-- e é por isso que este estado tem tela dedicada. Aqui só se confirma que não
-- levanta erro.
-- ===========================================================================
begin;
  set local role anon;
  select '6. sem vínculo' as caso,
         (select count(*) from public.scoped_seller_ids()) as alcance,
         'esperado 0, sem erro' as nota;
rollback;

-- ===========================================================================
-- 7. O QUE NÃO SE VÊ — o gestor não alcança consultor de outra equipe
-- ===========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = :'gestor';
  select '7. fora do escopo' as caso,
         count(*) as consultores_fora_do_alcance,
         string_agg(s.full_name, ', ' order by s.full_name) as quem
  from public.sellers s
  where s.status = 'ativo'
    and s.id not in (select public.scoped_seller_ids());
rollback;
