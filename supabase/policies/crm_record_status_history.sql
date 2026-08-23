-- Espelho das policies de public.crm_record_status_history.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0008_trilha_cadastral.sql.
--
-- Fonte: RLS_PERMISSOES.md §5.6 · D-023 · D-025.

alter table public.crm_record_status_history enable row level security;

-- ---------------------------------------------------------------------------
-- IMUTÁVEL NO BANCO
--
--   SELECT   permitido, restrito aos escopos desta sprint
--   INSERT   NENHUMA policy — negado para todos, ADMINISTRADOR INCLUSIVE
--   UPDATE   NENHUMA policy — negado para todos, ADMINISTRADOR INCLUSIVE
--   DELETE   NENHUMA policy — negado para todos, ADMINISTRADOR INCLUSIVE
--
-- Ausência de botão na interface não é imutabilidade. Ausência de policy é.
--
-- A gravação acontece exclusivamente pelas quatro funções `security definer` —
-- write_record_status_director/manager/team/seller —, que rodam como dono da
-- tabela e por isso atravessam a RLS. Cada uma tem o `scope` FIXO no corpo e não
-- aceita parâmetro: um gravador genérico anularia a imutabilidade, bastando
-- chamá-lo com os argumentos certos.
--
-- NÃO habilitar `force row level security`. Isso faria a RLS valer também para o
-- dono da tabela, e as próprias funções de trilha deixariam de gravar.
-- ---------------------------------------------------------------------------

-- SELECT restrito aos quatro escopos da Sprint 1, DE PROPÓSITO.
--
-- Os demais valores do CHECK — company, opportunity, contact, portfolio e os
-- outros — pertencem a entidades que ainda não existem, e cujo recorte por
-- escopo nasce na 0009 e nas sprints seguintes.
--
-- Uma leitura ampla agora ficaria aberta no dia em que essas linhas
-- aparecessem. É exatamente a dívida "provisória" que o sistema de origem
-- deixou correr três sprints (DE-025), e que D-018 existe para não repetir.
-- Aqui a linha de escopo novo nasce INVISÍVEL até alguém escrever a policy dela.
create policy crm_record_status_history_select on public.crm_record_status_history
  for select
  using (
    public.auth_role() is not null
    and scope in ('director', 'manager', 'team', 'seller')
  );
