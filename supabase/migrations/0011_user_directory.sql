-- 0011_user_directory.sql — Sprint 1, correção pós-revisão
--
-- Diretório restrito de usuários, para preencher o select de vínculo dos
-- formulários de diretor, gestor e vendedor. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ---------------------------------------------------------------------------
-- POR QUE UMA VIEW E NÃO ALARGAR A POLICY (D-032)
--
-- `profiles_select` permite leitura apenas da própria linha e do administrador
-- (§5.1). Mas quem escreve em estrutura comercial é `gestor_adm` além do
-- administrador, e o formulário precisa listar usuários para vincular
-- `profile_id`. Com a policy atual, o gestor não enxerga a lista.
--
-- Alargar `profiles_select` daria ao gestor `role`, `is_active` e o e-mail de
-- TODOS os usuários — quando ele precisa de um nome e um id. A matriz §3 dá
-- `usuarios.read` só ao administrador. A view atende a necessidade real sem
-- contrariar a matriz.
--
-- ---------------------------------------------------------------------------
-- ATENÇÃO — VIEW SOBRE TABELA COM RLS É `security definer` NA PRÁTICA
--
-- Ela roda com os privilégios de quem a criou e **IGNORA A RLS de `profiles`**.
-- O `WHERE` abaixo passa a ser A ÚNICA BARREIRA. Não é descuido: é o que torna a
-- view útil — com `security_invoker = true` ela respeitaria a RLS da base, o
-- gestor veria só a própria linha, e o problema não seria resolvido.
--
-- Consequências, que precisam ser lidas antes de qualquer alteração aqui:
--
--   1. O Security Advisor do Supabase vai apontar esta view como lint
--      (`security_definer_view`). É O MECANISMO. Documentar a exceção, não
--      "corrigir" — trocar para `security_invoker` quebra o vínculo.
--
--   2. ACRESCENTAR COLUNA AQUI ALARGA A LEITURA SEM TOCAR EM POLICY NENHUMA.
--      Um `email` acrescentado sem pensar exporia o e-mail de todos os usuários
--      a todo gestor, e nenhuma revisão de RLS acusaria, porque nenhuma policy
--      mudou. Toda alteração nesta view é alteração de superfície de exposição.
--
--   3. A autorização vive no próprio `WHERE`, não em GRANT: os papéis do CRM são
--      linhas em `profiles.role`, não roles do Postgres, então GRANT não
--      distingue gestor de consultor. Quem não é gestor nem administrador
--      recebe ZERO LINHAS — não um erro.
-- ---------------------------------------------------------------------------

drop view if exists public.user_directory;

create view public.user_directory
with (security_invoker = false)
as
select
  p.id,
  p.full_name
from public.profiles p
where p.is_active
  and public.has_role('administrador', 'gestor_adm');

comment on view public.user_directory is
  'Diretório mínimo de usuários ativos (id e nome) para preencher o select de vínculo profile_id nos cadastros de estrutura comercial (D-032). SECURITY DEFINER por necessidade: ignora a RLS de profiles, e o WHERE é a única barreira. Acrescentar coluna aqui alarga a leitura sem alterar policy alguma.';

-- `anon` não tem o que fazer aqui. O predicado de papel já devolveria zero
-- linhas, mas negar o acesso é mais barato que confiar na avaliação.
revoke all on public.user_directory from anon;
grant select on public.user_directory to authenticated;
