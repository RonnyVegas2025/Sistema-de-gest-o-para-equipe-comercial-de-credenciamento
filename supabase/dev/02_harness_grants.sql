-- Privilégios de tabela — o que o Supabase configura e as migrations assumem.
--
-- NÃO é parte do schema da aplicação e NUNCA é aplicado no projeto hospedado:
-- lá isto já existe, definido pelo bootstrap do Supabase.
--
-- ===========================================================================
-- POR QUE ESTE ARQUIVO EXISTE — e o que a sua ausência escondeu
--
-- Sem ele, `anon` e `authenticated` não têm privilégio nenhum sobre as tabelas
-- de `public`. Consequência medida em 26/08/2026:
--
--   set role authenticated;
--   select count(*) from public.companies;
--   ERROR:  permission denied for table companies
--
-- Ou seja: **nenhum teste local jamais exercitou a RLS.** Tudo rodou como
-- `postgres`, que é dono e não é filtrado por policy. E não é um limite só do
-- cluster local — o SQL Editor do painel também roda como dono, então os
-- scripts de verificação e o gate da Sprint 1 mediram o mesmo nada.
--
-- O que os `*_verificacao.sql` conferem sobre recorte é o `polqual` no catálogo:
-- que a policy existe e que chama `scoped_seller_ids()`. Isso é texto. Que ela
-- RECORTA — que um consultor lê uma linha e não lê outra — nunca foi medido.
--
-- É a mesma lacuna da 0014, um nível acima: lá a estrutura não alcançava o corpo
-- da função; aqui o catálogo não alcança o efeito da policy (D-018).
--
-- ===========================================================================
-- POR QUE `grant all`, E POR QUE ISSO NÃO É AFROUXAR NADA
--
-- É o que o Supabase faz. `anon` e `authenticated` recebem os quatro verbos em
-- todas as tabelas de `public`, e **a RLS é a única coisa que restringe** — é
-- literalmente o desenho da plataforma, e é por isso que "a RLS é a fronteira
-- real" não é slogan neste projeto.
--
-- Reproduzir menos privilégio aqui do que existe lá tornaria o teste local mais
-- permissivo na aparência e mais frouxo na prática: um `grant` estreito faria
-- casos passarem por `permission denied` em vez de pela policy — recusa pelo
-- motivo errado, que é indistinguível de proteção (CLAUDE.md).
--
-- Consequência que vale escrever: `DELETE` é concedido, e nenhuma tabela tem
-- policy de DELETE (D-023). O resultado esperado é `DELETE 0` — a RLS filtra o
-- conjunto, não levanta erro. Se algum dia aparecer erro de privilégio ali, é
-- porque este arquivo divergiu do painel, não porque o banco ficou mais seguro.
-- ===========================================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Cobre as tabelas que as migrations ainda vão criar. Vale porque o harness e as
-- migrations rodam sob o mesmo papel (`postgres`) — `alter default privileges`
-- só alcança objetos criados por quem a definiu.
alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
