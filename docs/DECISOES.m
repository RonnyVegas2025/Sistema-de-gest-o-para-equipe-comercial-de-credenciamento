# DIVERGÊNCIAS COM A BASE TÉCNICA

> Registro do que o documento *Base técnica reaproveitável — Vegas Card* afirma
> versus o que existe no repositório do Painel ADM de Produtos Agregados.
>
> Existe para que ninguém, daqui a seis meses, tente copiar algo que não está lá
> — ou refaça algo que já está.

---

## 0. Aviso de branch — leia antes de qualquer inspeção

O repositório tem branches em estágios diferentes:

| Branch | Estado |
| --- | --- |
| `main` | 283 arquivos, **18 migrations** (`0001`–`0018`). Três entregas atrás |
| `sprint-3-relatorios-e-estrutura-comercial` | 306 arquivos, **20 migrations** (`0001`–`0020`). É a referência |

**Inspecionar `main` produz diagnóstico errado.** A primeira revisão do
diagnóstico do CRM apontou seis divergências que não existiam — eram apenas
funcionalidades entregues na Sprint 3 e ausentes da `main`.

Sempre confirmar a branch antes de concluir que algo "não foi implementado".

---

## 1. Divergências reais

### DV-6 · `VEGAS-DESIGN-SYSTEM.md` não existe no repositório

**Gravidade:** alta · **Status:** resolvida por substituição de fonte

A base técnica cita o arquivo como "entregue à parte" e o Contexto Inicial §60 o
elege fonte canônica visual. Ele não está em nenhuma das duas branches.

**Tratamento (D-013).** A fonte normativa do CRM passa a ser
`VEGAS-PLATFORM-UI-STANDARD.md` + `tokens.css` + `IDENTIDADE_VISUAL.md`. O
`VEGAS-DESIGN-SYSTEM.md` **não é tratado como existente** enquanto não estiver
disponível, e nenhum documento do CRM deve citá-lo como fonte.

### DV-7 · Ajustes de contraste pendentes não localizáveis

**Gravidade:** média · **Status:** absorvida

A base técnica menciona "três ajustes de contraste pendentes listados no
documento do design system". Consequência de DV-6: a lista não pôde ser
localizada. `IDENTIDADE_VISUAL.md` estabelece contraste AA como piso não
negociável, mas não enumera os defeitos abertos.

**Tratamento.** O UI Standard define os ajustes de contraste (D-013). Se a lista
específica dos três não estiver lá, tratar como auditoria de contraste a fazer na
Sprint 0, não como correção conhecida a replicar.

### DV-9 · A RLS é fronteira de papel, não de escopo

**Gravidade:** alta · **Status:** é a lacuna central que o CRM preenche

A seção 3.1 da base técnica apresenta as três camadas de permissão com a RLS como
"a fronteira real". Verdadeiro para **papel**. Falso para **escopo**: nenhuma
policy do sistema de origem recorta por vendedor, equipe ou diretoria.

Estado verificado na branch de Sprint 3:

```sql
-- companies, teams, managers, sellers, directors: todas iguais
using (public.auth_role() is not null)
```

Não é defeito do documento nem descuido da implementação. DE-025 registra a
decisão explícita de adiar o recorte do comercial na Sprint 2, porque o cadastro
simples não tinha aresta de dono. O ponto que importa para o CRM é outro:

**A dívida ficou aberta três sprints.** É o comportamento previsível de uma
pendência de segurança que não impede nenhuma tela de funcionar — ninguém sente
falta, então ninguém prioriza.

**Tratamento (D-018).** No CRM, consultor enxergar carteira alheia é defeito
funcional, não melhoria futura. O escopo entra na Sprint 1, antes de qualquer
tela comercial, com testes de RLS como critério de fechamento.

---

## 2. Confirmado como implementado

Itens que a primeira revisão marcou como divergentes por ler a branch errada.
Todos existem na branch de referência:

| Item | Onde | Decisão do sistema de origem |
| --- | --- | --- |
| `directors` | `0020_diretoria_e_meta.sql`, `policies/directors.sql`, `src/lib/directors/`, `/diretores` | DE-035, DE-036 |
| `managers.director_id` | `0020` | DE-035 |
| `teams.conta_na_meta` | `0020`, checkbox no form, badge "Fora da meta" | DE-035, DE-037 |
| Round-trip export → reimport | `lib/contracts/export.ts`, `reimport.ts`, `/contratacoes/reimportar` | DE-031, DE-033 |
| Semântica coluna ausente × vazia | `reimport.ts` | DE-033 |
| 20 migrations | `0001`–`0020` | — |
| Desambiguação de equipes homônimas | `import/sellers.ts`: `norm()` preserva parênteses; nome ambíguo vira erro de linha | DE-039 |
| Importação de vendedores | `import/sellers.ts`, `/vendedores/importar` | DE-039 |
| Trilha de reabertura de fechamento | `0019_fechamento_reabertura.sql` | DE-034 |
| Vigência sem sobreposição por `exclude using gist` | `0017_product_cost_rules.sql`, com `btree_gist` | DE-026 |
| Ponte de perfil middleware → render | `lib/auth/profile-header.ts` + `middleware.ts` | DE-038 |

---

## 3. Dívidas conhecidas do sistema de origem — não replicar

### `managers.team_id` é vestigial

DE-040 registra: a coluna não é lida por nenhuma regra — nem painel, nem
importação. Existia só para se auto-exibir, e exibia errado, mostrando uma equipe
de "pertencimento" e escondendo as várias que o gestor de fato gerencia. Foi
ocultada, não removida, para preservar reversibilidade.

**No CRM a coluna não existe** (D-017). O vínculo de gerência é
`teams.current_manager_id`.

### `Permissions-Policy: geolocation=()`

O `next.config.mjs` do sistema de origem desabilita a API de geolocalização no
documento. Correto lá — o painel não usa. Copiado por inércia, mata visitas e
check-in no CRM, e o sintoma na tela é indistinguível de "usuário negou".

**No CRM: `geolocation=(self)`** (D-020).

### Deduplicação de vendedor por nome normalizado

`import/sellers.ts` deduplica por nome, e o comentário do código assume que
"vendedor não tem chave natural única". Suficiente na origem, que é a única
fonte. Insuficiente para replicação entre bancos, e proibido por P-001.

**No CRM: `source_ref`** com o UUID de origem (D-004).

### `enforce_inactivation_is_admin()` aplicada universalmente

No sistema de origem, toda entidade usa a mesma função: inativar é privilégio de
administrador, sem exceção. Funciona lá, onde o domínio é administrativo e
inativação é rara.

No CRM isso deixaria o gestor dependente do administrador para operação
corriqueira — encerrar vínculo de carteira, arquivar carteira, inativar contato
que saiu da empresa — e empurraria o usuário a usar `status = 'inativo'` como
sinônimo de "concluído", transformando o banco num cemitério de registros
inativos que na verdade só foram encerrados.

**No CRM: três categorias de enforcement** (D-022), com encerramento operacional
em coluna própria (`ended_at`, `closed_at`, status comercial), separado da
inativação cadastral.

### Trilha de reabertura guarda só o último evento

`0019` grava `reaberto_em` e `reaberto_por` — a **última** reabertura, não o
histórico de N. DE-034 assume a limitação conscientemente.

**No CRM**, onde reabertura de negociação tende a ser recorrente, usar tabela de
log desde o início: `crm_opportunity_status_history`, imutável no banco (D-023).

---

## 4. Aprendizados que evitam repetir depuração

Preservados da base técnica e confirmados no código:

- **404 com build limpo e log de runtime vazio** = a requisição não chega ao
  código. Era Framework Preset da Vercel em "Other". Log vazio significa
  suspeitar da plataforma, não da lógica.
- **Variáveis de ambiente vivem em três lugares que não se comunicam:**
  `.env.local`, secrets do GitHub Actions, Environment Variables da Vercel.
- **`alter table add constraint` não aceita `if not exists`.** Envolver em bloco
  `DO` guardado por `pg_constraint`.
- **Migration com `drop policy` precisa de transação.** Falha após o `drop` deixa
  a tabela sem SELECT — ninguém lê nada, incluindo o próprio login.
- **View que lê tabela com RLS é `security definer` na prática.** O `WHERE` dela
  é a única barreira. O linter do Supabase aponta; documentar a exceção, não
  "corrigir".
- **Latência de rede domina quando banco e aplicação estão em regiões
  diferentes.** Supabase em `sa-east-1` pede função da Vercel em `gru1`.
  Paralelizar consultas independentes com `Promise.all` e não duplicar leitura
  no caminho compartilhado.
