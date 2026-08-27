#!/usr/bin/env bash
#
# Reconstrói o schema do zero num PostgreSQL local, aplicando
# supabase/migrations/ na ordem numérica.
#
# POR QUE ISTO EXISTE
#
# As migrations são aplicadas no projeto hospedado colando no SQL Editor
# (D-031), então o banco não conhece o histórico e não há `db push` para
# reproduzir. O cluster local é onde cada migration é aplicada, testada e
# provada por mutação ANTES de ir para o painel — foi o que pegou cinco erros de
# expectativa nos scripts de verificação da Sprint 1.
#
# Esse cluster já morreu uma vez com a reciclagem do ambiente, e reconstruí-lo à
# mão custou uma etapa. Agora custa um comando.
#
# E O SCRIPT É, ELE PRÓPRIO, UMA VERIFICAÇÃO
#
# Se a sequência não reconstrói o schema do zero, alguma migration não é
# reproduzível — depende de estado que não está no repositório. Isso é achado,
# não inconveniente: o repositório é a única fonte da ordem aplicada (D-031), e
# uma migration que só funciona sobre um banco já sujo invalida essa premissa.
#
# USO
#
#   supabase/dev/reconstruir.sh              reconstrói e aplica tudo
#   supabase/dev/reconstruir.sh --checks     idem, e roda verificação e comportamento
#   supabase/dev/reconstruir.sh --ate 0009   para depois da 0009
#
# Conectar depois:  PGHOST=/tmp PGPORT=5599 PGUSER=postgres psql -d crm

set -euo pipefail

# O PostgreSQL recusa rodar como root. Quando o script é chamado por root — que
# é o caso neste ambiente —, ele se reexecuta como `postgres`. Fica aqui, e não
# nas instruções, porque instrução que depende de alguém lembrar não sobrevive à
# próxima reciclagem do ambiente.
if [ "$(id -u)" -eq 0 ]; then
  exec su postgres -s /bin/bash -c "$(printf '%q ' "${BASH_SOURCE[0]}" "$@")"
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DADOS=${CRM_PGDATA:-/var/lib/postgresql/crmtest}
PORTA=${CRM_PGPORT:-5599}
SOCKET=${CRM_PGSOCKET:-/tmp}
BANCO=crm

RODAR_CHECKS=0
PERFIS_APLICADOS=0
ATE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --checks) RODAR_CHECKS=1 ;;
    --ate) ATE="$2"; shift ;;
    *) echo "argumento desconhecido: $1" >&2; exit 2 ;;
  esac
  shift
done

export PGHOST="$SOCKET" PGPORT="$PORTA" PGUSER=postgres
# Cala os NOTICE de `drop ... if exists`, que toda migration idempotente emite.
# Sem isso o ruído esconde o que importa — e o que importa é o ERROR.
export PGOPTIONS='-c client_min_messages=warning'

titulo() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

titulo "cluster"
if [ ! -s "$DADOS/PG_VERSION" ]; then
  echo "inicializando em $DADOS"
  rm -rf "$DADOS"
  mkdir -p "$DADOS"
  "$PGBIN/initdb" -D "$DADOS" -U postgres --auth=trust >/dev/null
else
  echo "reaproveitando $DADOS"
fi

if "$PGBIN/pg_ctl" -D "$DADOS" status >/dev/null 2>&1; then
  echo "servidor já no ar"
else
  "$PGBIN/pg_ctl" -D "$DADOS" -l "$DADOS/postgres.log" \
    -o "-p $PORTA -k $SOCKET -c listen_addresses=''" -w start >/dev/null
  echo "servidor iniciado na porta $PORTA"
fi

titulo "banco $BANCO"
# Recriar em vez de limpar: só um banco novo prova que a sequência reconstrói do
# zero. Reaplicar sobre schema existente esconde exatamente o que se quer testar.
psql -d postgres -q -c "drop database if exists $BANCO with (force)" 2>/dev/null \
  || psql -d postgres -q -c "drop database if exists $BANCO"
psql -d postgres -q -c "create database $BANCO"

# Marca que ESTE banco é o cluster local. Os scripts de comportamento que
# escrevem em crm_record_status_history recusam rodar sem ela (D-043): a trilha
# é o único artefato irrecuperável do sistema, e um script pronto que a apaga
# acabaria sendo colado no painel um dia, por alguém depurando outra coisa.
# Reproduzi-la no projeto hospedado é possível — e passa a ser decisão tomada na
# hora, com o risco na mesa, em vez de herdada de um arquivo que já estava lá.
psql -d postgres -q -c "alter database $BANCO set crm.cluster_local = 'sim'"
echo "recriado (crm.cluster_local = sim)"

titulo "harness (o que o Supabase provê)"
psql -d "$BANCO" -q -v ON_ERROR_STOP=1 -f "$RAIZ/supabase/dev/00_harness_auth.sql"
echo "auth.users, auth.uid(), anon/authenticated/service_role"
# ANTES das migrations: `alter default privileges` só alcança o que for criado
# depois dela. Sem isto, `set role authenticated` devolve permission denied e
# nenhum teste chega a exercitar a RLS.
psql -d "$BANCO" -q -v ON_ERROR_STOP=1 -f "$RAIZ/supabase/dev/02_harness_grants.sql"
echo "grants de anon/authenticated/service_role — a RLS passa a ser a única barreira"

titulo "migrations"
aplicadas=0
falhas=0
for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
  nome="$(basename "$arquivo")"
  if ! psql -d "$BANCO" -q -v ON_ERROR_STOP=1 -f "$arquivo"; then
    echo "FALHOU em $nome — a sequência não reconstrói do zero." >&2
    exit 1
  fi
  echo "  ok  $nome"
  aplicadas=$((aplicadas + 1))

  # ────────────────────────────────────────────────────────────────────────
  # A verificação roda LOGO DEPOIS da sua migration, nunca no fim de tudo.
  #
  # Os scripts de supabase/checks/ são afirmações de MOMENTO: além de conferir
  # o que a migration criou, vários afirmam o que ainda NÃO deve existir —
  # "nenhuma coluna a mais", "source_ref ainda não existe", "current_manager_id
  # ainda sem FK". São verdadeiras logo após a própria migration e falsas
  # depois que a seguinte roda.
  #
  # Isso não é defeito dos scripts: é o que os torna úteis, porque pegam
  # migration que faz mais do que declara. Mas obriga a rodá-los intercalados,
  # que é como são usados de verdade — aplicar, verificar, seguir (D-031).
  # ────────────────────────────────────────────────────────────────────────
  if [ "$RODAR_CHECKS" -eq 1 ]; then
    prefixo="${nome%%_*}"
    check="$RAIZ/supabase/checks/${prefixo}_verificacao.sql"
    if [ -f "$check" ]; then
      saida="$(psql -d "$BANCO" -At -F '|' -f "$check" 2>&1)"
      ruins="$(printf '%s\n' "$saida" | grep -vc '|OK$' || true)"
      if [ "$ruins" -ne 0 ]; then
        echo "      FALHA na verificação — $ruins linha(s) fora de OK"
        printf '%s\n' "$saida" | grep -v '|OK$' | head -5
        falhas=$((falhas + 1))
      else
        linhas="$(printf '%s\n' "$saida" | grep -c '|OK$' || true)"
        echo "      verificação ok — $linhas checagens"
      fi
    else
      echo "      SEM script de verificação para $prefixo" >&2
      falhas=$((falhas + 1))
    fi

    # ──────────────────────────────────────────────────────────────────────
    # Comportamento — o que a verificação estrutural NÃO alcança.
    #
    # `*_verificacao.sql` lê o catálogo do Postgres: confere que a função
    # existe, que a trigger é BEFORE, que o execute foi revogado. É cega para
    # o CORPO. Medido na 0014: trocando a bicondicional por uma implicação
    # simples, a verificação seguiu com todas as linhas OK e a linha proibida
    # entrou.
    #
    # Estes scripts ESCREVEM, medem e limpam — por isso são arquivos separados,
    # e por isso rodam depois da verificação, nunca no lugar dela.
    # ──────────────────────────────────────────────────────────────────────
    #
    # DOIS DIRETÓRIOS, E A DIFERENÇA IMPORTA
    #
    #   supabase/checks/<pref>_comportamento.sql   pode ser colado no painel
    #   supabase/dev/comportamento/<pref>_*.sql    NUNCA — só daqui
    #
    # O segundo grupo escreve em crm_record_status_history. A localização é a
    # separação: `checks/` é o diretório do que se cola no SQL Editor, e aviso
    # em cabeçalho só é lido por quem já está prestando atenção (D-043).
    for comportamento in "$RAIZ/supabase/checks/${prefixo}_comportamento.sql" \
                         "$RAIZ"/supabase/dev/comportamento/"${prefixo}"_*.sql; do
      [ -f "$comportamento" ] || continue
      # Fixture lazy: perfis de teste só quando o primeiro comportamento pedir.
      # Aplicá-la junto do harness mudaria a contagem de 0002_verificacao.sql.
      if [ "$PERFIS_APLICADOS" -eq 0 ]; then
        psql -d "$BANCO" -q -v ON_ERROR_STOP=1 -f "$RAIZ/supabase/dev/01_harness_perfis.sql"
        PERFIS_APLICADOS=1
      fi
      saida="$(psql -d "$BANCO" -q -At -F '|' -f "$comportamento" 2>&1)"
      ruins="$(printf '%s\n' "$saida" | grep -vc '|OK$' || true)"
      if [ "$ruins" -ne 0 ]; then
        echo "      FALHA em $(basename "$comportamento") — $ruins linha(s) fora de OK"
        printf '%s\n' "$saida" | grep -v '|OK$' | head -8
        falhas=$((falhas + 1))
      else
        linhas="$(printf '%s\n' "$saida" | grep -c '|OK$' || true)"
        echo "      comportamento ok — $linhas caso(s)  [$(basename "$comportamento")]"
      fi
    done
  fi

  if [ -n "$ATE" ] && [[ "$nome" == "$ATE"* ]]; then
    echo "  (parando em $nome, como pedido)"
    break
  fi
done
echo "$aplicadas migration(s) aplicadas"
[ "$falhas" -eq 0 ] || { echo "$falhas verificação(ões) reprovaram." >&2; exit 1; }

titulo "pronto"
echo "PGHOST=$SOCKET PGPORT=$PORTA PGUSER=postgres psql -d $BANCO"
