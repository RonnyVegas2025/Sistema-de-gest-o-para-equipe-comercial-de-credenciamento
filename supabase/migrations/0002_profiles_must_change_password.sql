-- 0002_profiles_must_change_password.sql — Sprint 1, etapa 6
--
-- Sustenta a troca obrigatória de senha no primeiro acesso e após regeneração.
-- Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ---------------------------------------------------------------------------
-- DIVERGE DO SISTEMA DE ORIGEM: o default aqui é `true`, lá é `false`.
--
-- É deliberado e segue MODELO_DADOS.md §2.1. O usuário do CRM nasce por ação de
-- administrador (D-009), recebendo uma senha temporária gerada pelo sistema —
-- então "precisa trocar a senha" é o estado normal de um perfil recém-criado, e
-- não a exceção. Com default `false`, cada caminho de criação teria de lembrar
-- de ligar o flag; esquecer significaria um usuário circulando com senha
-- temporária, e o esquecimento não produz sintoma visível.
--
-- Com default `true`, o esquecimento erra para o lado seguro: no máximo pede uma
-- troca de senha a mais.
-- ---------------------------------------------------------------------------
--
-- Quem LIGA:    a Edge Function admin-create-user (service role), na criação e
--               na regeneração de senha. Também o próprio default, acima.
-- Quem DESLIGA: a conclusão da troca em /trocar-senha. É self-update: a policy
--               profiles_update permite ao usuário editar a própria linha, e o
--               trigger prevent_profile_tampering NÃO barra esta coluna — ele
--               barra apenas role, is_active e email. Ver a verificação em
--               supabase/checks/0002_verificacao.sql, que confirma isso.
-- Onde é LIDO:  o middleware, na mesma consulta a profiles que já lê is_active,
--               e o layout de (app) via requireProfile — duas camadas.
--
-- Não é fronteira de segurança, é gate de higiene sobre usuário já autenticado:
-- limpar o flag sem trocar a senha só prejudicaria o próprio usuário, que
-- ficaria com a senha temporária. A fronteira real continua sendo a RLS.

alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

comment on column public.profiles.must_change_password is
  'Enquanto true, a única rota alcançável é /trocar-senha. Ligado na criação e '
  'na regeneração de senha; desligado pelo próprio usuário ao concluir a troca.';
