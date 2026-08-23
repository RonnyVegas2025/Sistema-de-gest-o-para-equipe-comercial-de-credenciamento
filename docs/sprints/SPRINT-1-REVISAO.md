# Sprint 1 — Parada obrigatória para revisão

Entregue ao término da **etapa 9**, conforme `SPRINT-1.md`.

> **Revisão retornada e liberada.** As decisões estão na seção 9. As etapas 10 e
> 11 foram executadas depois: `docs/ARQUITETURA.md` descreve o que ficou
> implementado, e a validação em navegador está registrada abaixo, na seção 7.

Branch: `sprint-1/fundacao`. A contagem de commits muda a cada correção, então
não é fixada aqui — use `git rev-list --count origin/main..HEAD`.

---

## 1. Como ler este documento

A sprint foi executada com uma separação que vale carregar para a revisão:

| Nível | O que significa |
| --- | --- |
| **Provado contra Postgres real** | rodou num cluster PostgreSQL, com asserção sobre o resultado |
| **Provado por mutação** | além de rodar, o código foi quebrado de propósito e o teste reprovou |
| **Coberto com dublê** | a lógica foi exercitada com dependência simulada |
| **Não rodou** | escrito e revisado, nunca executado |

Nada abaixo é marcado como cumprido sem ter rodado. A seção 6 lista o que não
rodou, sem exceção.

---

## 2. Execução, etapa por etapa

### Etapa 1 — Fundação do repositório
Ferramental copiado da branch de referência. `npm run verify` passa nas cinco
fases.

**Divergiu do plano:** o aceite dizia "projeto vazio", mas `verify` termina em
`next build`, que não roda sem `layout.tsx` e `page.tsx`. O aceite foi corrigido
para "sem domínio, sem tela, sem migration", e os dois arquivos nasceram mínimos.

Acrescentei `security-headers.test.ts` em vez de ligar `passWithNoTests`: a flag
ficaria ligada para sempre e, a partir da etapa 9, esconderia a ausência dos
testes de RLS.

### Etapa 2 — Tokens, marca e biblioteca
28 componentes, tokens e catálogo. As cinco correções do UI Standard §3.1
aplicadas, com contraste **calculado pela fórmula WCAG**, não estimado:

| | antes | depois | mínimo |
| --- | --- | --- | --- |
| Peach 600 sobre Peach 50 | 4,36:1 ❌ | 4,93:1 ✅ | 4,5 |
| borda de campo sobre surface | 1,25:1 ❌ | 3,11:1 ✅ | 3,0 |

Os dois valores antigos reprovavam de fato.

**Divergiu do plano:** o shell (`app-shell`, `sidebar`, `topbar`, `mobile-nav`,
`user-menu`) **não** entrou aqui. Todos dependem de `@/lib/auth/session`,
`@/config/navigation` ou `@/types/database`, que nascem nas etapas 4 e 6.
Copiá-los exigiria stubs, e stub criado para destravar etapa sobrevive e
apodrece. Migraram para a etapa 4.

### Etapa 3 — Ambiente e configuração
`.env.example`, `supabase/config.toml`, scripts e README.

**Fato decisivo descoberto aqui:** o ambiente do agente **bloqueia saída para
`supabase.co`** por política de rede. Não é credencial faltando — o gateway
recusa a conexão antes de qualquer autenticação. Isso, somado a quem opera o
projeto trabalhar por painel e GitHub web, produziu **D-031**: migrations
aplicadas pelo SQL Editor, com o repositório como única fonte da ordem aplicada.

### Etapa 4 — Autenticação, papéis, shell
**Três divergências corrigidas sobre a origem, em vez de replicadas.**

**D-029 — o `delete` do `x-user-profile` em um ramo só.** O middleware da origem
saneia o header apenas no ramo de rota protegida com sessão. Rota pública devolve
a resposta sem sanear, e `getSessionProfile()` confia no header sem condição
quando ele existe. Como `/dev` é rota pública e seu layout exige administrador,
**em preview um header forjado atravessa o gate**. Aqui o `delete` ocorre antes
de qualquer decisão de rota.

**A verificação obrigatória de D-019 nunca existiu na origem** — `x-user-profile`
aparece em três arquivos de código e em nenhum dos 29 de teste.

**D-030 — `serverEnv()` sem chamador.** O `env.ts` da origem valida
`SUPABASE_SERVICE_ROLE_KEY` numa função que nenhum arquivo chama, nos dois
repositórios. Removida: um schema no runtime do Next exigindo a chave convidaria
a cadastrá-la na Vercel. Depois da remoção, a string não aparece em
`.next/server` nem em `.next/static`.

`roles.ts` e `can.ts` reescritos pela matriz do CRM (D-002).

### Etapa 5 — Regras de migration
Sem arquivo. Regras em D-021 e D-031.

### Etapa 6 — Estrutura comercial (`0001`–`0006`)
Quatro entidades, RLS, triggers. **Duas ausências deliberadas, ambas provadas:**

**Sem `managers.team_id`** (D-017) — um gestor com **três equipes** apontando
para ele, relação que a coluna não representaria.

**Sem `sellers.manager_id`** — criei consultora em equipe gerida por João,
troquei o gestor da equipe para Maria **sem tocar em `sellers`**, e a consulta
passou a devolver Maria. A coluna teria ficado desatualizada naquele instante.

**Divergiu da origem:** `profiles_select` **não inclui `gestor_adm`**. A policy
de lá é mais ampla que a matriz §3 — divergência que a origem registra e não
reconciliou.

### Etapa 7 — `source_ref` e motor de importação
Migration `0007` mais o motor em TypeScript. Quatro specs, dedup por
`source_ref`, casamento que nunca é silencioso.

**Entrega o mecanismo, não os dados.** A carga real depende de exportação do
Painel que ainda não existe.

**Sem tela** — ela entra na Sprint 3, para preservar o "ainda não existe nenhuma
tela comercial" desta parada.

### Etapa 8 — Trilha cadastral
`crm_record_status_history`, imutável no banco. **Uma função de trilha por
entidade**, com `security definer`, `search_path` fixo e `execute` revogado.

**Divergiu do plano:** o `SELECT` da trilha é restrito aos quatro escopos desta
sprint. O `CHECK` aceita doze valores; os outros oito pertencem a entidades que
não existem, e leitura ampla agora ficaria aberta quando surgissem — a dívida
"provisória" do DE-025.

### Etapa 9 — Escopo hierárquico
Funções de identidade e `scoped_seller_ids()`, com **união, nunca primeiro papel
encontrado**.

**Divergiu do plano:** as policies com recorte **não têm onde ser presas**. As
cinco tabelas de §5.3 nascem da Sprint 2. A função nasce pronta e provada; a
Sprint 2 a pendura.

---

## 3. As onze migrations

| # | Arquivo | Conteúdo | Verificação |
| --- | --- | --- | --- |
| 0001 | `0001_profiles.sql` | `app_role`, `profiles`, funções de apoio, triggers, RLS | 27 ✅ |
| 0002 | `0002_profiles_must_change_password.sql` | `must_change_password`, default `true` | 7 ✅ |
| 0003 | `0003_entity_status_teams.sql` | `entity_status`, duas funções de inativação, `teams` | 27 ✅ |
| 0004 | `0004_directors.sql` | `directors` | 23 ✅ |
| 0005 | `0005_managers.sql` | `managers` + FK circular | 30 ✅ |
| 0006 | `0006_sellers.sql` | `sellers` + fechamento da etapa | 31 ✅ |
| 0007 | `0007_source_ref.sql` | `source_ref` + índices únicos parciais | 17 ✅ |
| 0008 | `0008_trilha_cadastral.sql` | trilha imutável, quatro funções | 40 ✅ |
| 0009 | `0009_escopo_hierarquico.sql` | funções de escopo | 21 ✅ |
| 0010 | `0010_reactivation_reason.sql` | motivo da reativação em coluna própria | 23 ✅ |
| 0011 | `0011_user_directory.sql` | view restrita de usuários para vínculo | 9 ✅ |

**255 checagens, todas OK contra o banco real.** Todas as onze são idempotentes,
verificado por reaplicação.

As `0010` e `0011` nasceram do retorno desta revisão (seção 9), não da execução
original das etapas.

---

## 4. Testes de ataque — §6.2

Executados na etapa 8, contra Postgres real. **Todos negados:**

| Tentativa | Resultado |
| --- | --- |
| chamar cada função de trilha direto, usuário comum | `permission denied` |
| idem, **como administrador** | `permission denied` |
| `INSERT` direto na trilha, usuário comum | negado pela RLS |
| idem, **como administrador** | negado pela RLS |
| `UPDATE` da trilha por administrador | `UPDATE 0` |
| `DELETE` da trilha por administrador | `DELETE 0` |
| ler escopo de outra sprint, como administrador | 0 linhas |

### A mutação que mais importa

```
baseline        -> FALHAs: 0  | ataque direto: NEGADO
após o grant    -> FALHAs: 1  | ataque direto: >>> PERMITIDO — forjável <<<
   a trilha continua gravando normalmente, sem sintoma algum
restaurado      -> FALHAs: 0  | ataque direto: NEGADO
```

`revoke execute` esquecido **não quebra nada visível**. Nenhuma tela falha,
nenhum teste funcional reclama. Só a verificação acusa.

Aprendizado colateral: revogar só de `authenticated` **não** tira o privilégio —
o `grant` implícito de `PUBLIC` o sustenta. Os dois são necessários.

---

## 5. Testes de RLS — §6.1

**Parcialmente verificável nesta sprint.** Os cenários que dependem de carteira,
oportunidade, atividade e contato exigem tabelas da Sprint 2.

Verificado contra Postgres real:

| Cenário | Resultado |
| --- | --- |
| consultor lê só a própria linha de `profiles` | 1 de 3 ✅ |
| gestor lê só a própria linha | 1 de 3 ✅ |
| administrador lê todas | 3 de 3 ✅ |
| anônimo não lê nada | 0 ✅ |
| usuário altera o próprio `role` | recusado pelo trigger ✅ |
| **administrador** altera o próprio `role` | recusado ✅ |
| qualquer papel tenta `DELETE` | `DELETE 0` ✅ |
| usuário autenticado **sem perfil** lê estrutura | 0 linhas ✅ |
| gestor inativa entidade de cadastro mestre | recusado ✅ |
| gestor encerra por vigência | permitido ✅ |
| inativar sem motivo | recusado pelo banco ✅ |
| operação tenta forjar `inactivated_at/by` | sobrescrito pelo banco ✅ |
| gestor tenta reativar | recusado ✅ |
| `UPDATE` que não muda status | nenhuma linha de trilha ✅ |

---

## 6. O que NÃO rodou

**Esta é a seção que a revisão precisa ler com atenção.**

| Item | Estado | Depende de |
| --- | --- | --- |
| **Gate de cinco usuários no banco real** | script pronto, nunca executado lá | Edge Function implantada + cinco usuários criados |
| Login real | nunca rodou | mesma coisa |
| Troca obrigatória de senha ponta a ponta | nunca rodou | mesma coisa |
| Bloqueio de usuário desativado em sessão | nunca rodou | mesma coisa |
| Edge Function `admin-create-user` | copiada, nunca implantada nem executada | deploy |
| `e2e/auth.spec.ts` | adaptado, nunca executado | app rodando contra Supabase |
| Persistência da importação | coberta só com dublê | PostgREST real |
| Carga da estrutura comercial | não aconteceu | exportação do Painel |
| Cenários de §6.1 com recorte | não verificáveis | Sprint 2 |
| Deploy na Vercel | não feito | decisão de adiar |

O gate de cinco usuários **rodou aqui com dados de teste** e passou nos sete
casos, incluindo conferência independente da união. Contra o banco real, não.

---

## 7. Etapa 10 — verificação

```
format:check   All matched files use Prettier code style!
lint           ✔ No ESLint warnings or errors
typecheck      ✔
test           Test Files 9 passed · Tests 151 passed
build          ✓ Compiled successfully — 9 rotas + middleware
```

O build roda com **valores de placeholder**, não com o projeto real.

**Service role no bundle:** ausente de `.next/static` **e** de `.next/server`.

### Validação em navegador

Feita com o Chromium do ambiente, nas rotas alcançáveis sem Supabase — `/login`,
`/esqueci-senha`, `/nova-senha`. As rotas autenticadas e o catálogo `/dev` não
são alcançáveis sem sessão.

| | desktop (1440 px) | tablet (768 px) |
| --- | --- | --- |
| altura de `input` | 40 px | **44 px** |
| altura de `button` | 40 px | **44 px** |
| foco visível por teclado | sim (`box-shadow`) | sim |
| rótulos visíveis | "E-mail", "Senha" | idem |
| hexadecimal no HTML | 2 — ambos a meta `theme-color` (exceção documentada) | idem |

**D-027 confirmado em navegador real**, não só em teste estático. O painel
institucional vira faixa curta no topo no tablet, com a fita de 3 px preservada.

**Não validado:** os cinco estados (`loading`, `empty`, `error`, `forbidden`,
`success`) exigem dados e sessão; nenhuma tela com dados existe ainda.

---

## 8. Decisões registradas nesta sprint

| # | Assunto |
| --- | --- |
| D-027 | Alvo de toque responsivo |
| D-028 | CLI do Supabase fixado no projeto |
| D-029 | Saneamento de `x-user-profile` no topo do middleware |
| D-030 | Sem `serverEnv()` |
| D-031 | Migrations aplicadas pelo SQL Editor |

---

## 9. Retorno da revisão — decisões tomadas

As quatro pendências abaixo foram decididas. Duas viraram migration; duas viraram
documento.

| # | Decisão | Onde |
| --- | --- | --- |
| 1 | View restrita de usuários, expondo só `id` e `full_name` | **D-032** · migration `0011` ✅ |
| 2 | FKs de vínculo mantidas em `NO ACTION` | **D-034** |
| 3 | `reactivation_reason` em coluna própria | **D-033** · emenda a D-025 · migration `0010` ✅ |
|   | *(as duas migrations foram aplicadas e verificadas no banco real)* | |
| 4 | Ordem para destravar: Edge Function → cinco usuários → gate → login → Vercel | registrada em `SPRINT-1.md` |

Também registrado, por ser armadilha de repetição: **revogar `execute` apenas de
`authenticated` é inócuo**, porque o grant implícito de `PUBLIC` sustenta o
privilégio. Está em `RLS_PERMISSOES.md` §5.6 — que é onde alguém lê ao escrever a
próxima função de trilha — e resumido no `CLAUDE.md`.

### Pendências originais, para registro

### O que estava em aberto

1. **`profiles_select` não inclui `gestor_adm`.** O gestor escreve em estrutura
   comercial mas **não enxerga a lista de usuários** para vincular `profile_id`.
   Saídas: view restrita expondo só id e nome, ou alargar a policy.

2. **FK de `profile_id` sem ação de delete.** Apagar um usuário no painel de Auth
   é bloqueado com erro de FK. Mantido de propósito; a alternativa é
   `on delete set null`.

3. **Motivo da reativação usa `inactivation_reason`.** D-025 exige motivo nos
   dois sentidos mas não diz qual coluna o carrega na reativação. A coluna virou
   "motivo da transição mais recente".

4. **Ordem para destravar o que não rodou:** implantar a Edge Function → criar os
   cinco usuários → rodar o gate → login e troca de senha → Vercel.
