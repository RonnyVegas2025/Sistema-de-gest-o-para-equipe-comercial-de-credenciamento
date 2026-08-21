# SPRINT 1 — Fundação: auth, estrutura comercial e escopo

> **Autorizada.** Ordem de execução fixa, definida pelo responsável.
>
> Esta é a sprint mais crítica do projeto: auth + hierarquia + RLS + escopo são o
> alicerce. Depois que isso estiver certo, as telas comerciais andam rápido.
> Errado, contamina tudo que vier depois.

Fontes canônicas: `DECISOES.md` (D-001 a D-030) · `MODELO_DADOS.md` ·
`RLS_PERMISSOES.md` · `DIVERGENCIAS_BASE.md`.

**Repositório-base de referência:** branch
`sprint-3/relatorios-e-estrutura-comercial`. Inspecionar `main` produz
diagnóstico errado — está uma entrega atrás — `main` está na Sprint 2 (v0.4.0)
e a branch de Sprint 3 tem 10 commits à frente.

---

# Ordem de execução

Sequencial. Não paralelizar, não antecipar etapa posterior.

**A numeração das migrations acompanha a das etapas.** Nenhuma migration é
aplicada fora de ordem: `0008` inteira antes de qualquer parte da `0009`.

## 1 · Fundação do repositório

Copiar do repositório-base:

```
package.json (sem deps de Agregados)   tsconfig.json
.eslintrc.json  .prettierrc  .prettierignore  .editorconfig
.nvmrc (22)  .gitignore  .husky/pre-commit
vitest.config.ts  vitest.setup.ts  playwright.config.ts
.github/workflows/ci.yml  .github/workflows/rls-integration.yml
```

**`next.config.mjs` não é cópia literal:** `Permissions-Policy` vai com
`geolocation=(self)`; câmera e microfone permanecem desligados (D-020).

*Aceite:* `npm run verify` passa num projeto sem domínio, sem tela e sem
migration. `src/app/layout.tsx` e `src/app/page.tsx` nascem mínimos aqui — não
são scaffolding descartável: crescem na etapa 2, quando o layout recebe
`globals.css` e a fonte, e a página vira o redirect para `/inicio`.

## 2 · Next.js, Tailwind, tokens e shell Vegas

- `tokens.css`, `tailwind.config.ts`, `brand.ts`, `public/brand/*`
- 28 componentes de `src/components/ui/` — a lista é o próprio
  `src/components/ui/` da branch de referência
- `breadcrumb` e `page-header` (ambos vivem em `ui/` e não dependem de sessão)
- `app/dev/componentes` — catálogo vivo, 404 em produção, com gate de ambiente
  fail-closed
- `docs/IDENTIDADE_VISUAL.md`, adaptado do equivalente na branch de referência,
  documentando os tokens **como efetivamente copiados**, com as cinco correções
  da §3.1 do UI Standard já aplicadas. Descreve o que existe, não o que se
  pretende — mesma regra do `ARQUITETURA.md` (A-006).

**Cinco correções obrigatórias na cópia** — `VEGAS-PLATFORM-UI-STANDARD.md` §3.1.
São defeitos conhecidos do sistema de origem; copiar sem corrigir é replicá-los:

1. `Peach 600`: `#A85C4E` → ~`#9E5445` (AA sobre `Peach 50`)
2. criar `--vg-border-field` ~`#8E90AD` para borda de input (3:1)
3. label visível permanente; placeholder nunca substitui rótulo
4. eliminar `text-ink-muted`; usar `ink-secondary` ou `muted` conforme a função
5. sem espelho manual de token — `tokens.css` é a fonte, e a sincronia com
   `brand.ts`/JSON vira **teste**, não convenção

**Auditoria de alvo touch** (UI Standard §19) nos componentes copiados:
`button`, `input`, `select`, `checkbox` e linhas de tabela. O sistema de origem
foi construído para desktop administrativo; o CRM roda em tablet no campo.
Antecipada da Sprint 6 para cá — corrigir na cópia custa uma fração de corrigir
depois em todas as telas. O alvo é **responsivo**: 44 px na base, densidade
compacta a partir de `lg:` (D-027).

Não trazer `costs/cost-rule-card` nem páginas de negócio de Agregados.

**O shell não entra nesta etapa.** `app-shell`, `shell-chrome`, `sidebar`,
`sidebar-nav`, `topbar`, `mobile-nav` e `user-menu` dependem de
`@/lib/auth/session`, `@/config/navigation` e `@/types/database` — que nascem nas
etapas 4 e 6. Copiá-los aqui exigiria stubs, e stub criado para destravar etapa
sobrevive e apodrece. Migram para a etapa 4, junto com `navigation.ts`.

*Aceite:* catálogo de componentes renderiza; nenhum hexadecimal fora de
`tokens.css`, salvo o espelho de `brand.ts` coberto por teste; as cinco correções
aplicadas; contraste AA verificado por cálculo; `docs/IDENTIDADE_VISUAL.md`
descrevendo o que ficou.

## 3 · Supabase e ambientes

Projeto novo, independente (D-001). Região do Supabase e região/runtime da
Vercel **na mesma região** — latência entre regiões multiplica por round-trip.

Variáveis nos três lugares que não se comunicam: `.env.local`, GitHub Actions
Secrets, Vercel (Production, Preview, Development).

*Aceite:* build na Vercel com Framework Preset **Next.js** — preset em "Other"
produz 404 com build limpo e log de runtime vazio.

## 4 · Autenticação

Copiar: Edge Function `admin-create-user`, `lib/supabase/{client,server,middleware}`,
`lib/auth/session.ts`, `lib/auth/profile-header.ts`, `middleware.ts`, telas de
login, esqueci-senha, nova-senha e trocar-senha.

**Vindo da etapa 2**, agora que as dependências existem:

- o shell — `app-shell`, `shell-chrome`, `sidebar` (248/72 px), `sidebar-nav`,
  `topbar` (64 px), `mobile-nav`, `user-menu`;
- `src/config/navigation.ts`, com as chaves de módulo desta sprint;
- `src/app/page.tsx` passa a redirecionar para `/inicio`, que só existe sob o
  layout autenticado de `(app)`;
- a segunda barreira de `/dev` — sessão mais perfil administrador — sobre o gate
  de ambiente que a etapa 2 deixou pronto.

Adaptar apenas: nome do sistema, texto institucional, `PUBLIC_PREFIXES`.

**Dois detalhes que não sobrevivem a uma reescrita descuidada:**

1. Nenhuma lógica entre criar o client e `getUser()` no middleware — a renovação
   do token depende dessa ordem.
2. O middleware **remove** `x-user-profile` recebido do cliente **antes** de
   setar o validado (D-019). O `delete` precede o `set`.

*Aceite:* login, troca obrigatória de senha, bloqueio de usuário desativado em
meio a sessão, e o teste de header forjado de `RLS_PERMISSOES.md` §6.3. Mais:
**eliminar as 9 ocorrências restantes de `text-ink-muted` nos componentes de
shell** — `ink.muted` já saiu do Tailwind na etapa 2, então elas quebram o build
na chegada. `ink-secondary` para prosa subordinada, `muted` para metadado e
adorno, como na etapa 2.

## 5 · Sequência própria de migrations

O CRM inicia sua numeração em `0001`. Não copiar migrations em bloco.

Regras permanentes (D-021): **uma migration por vez**, aplicada e validada antes
da próxima. Não agrupar para ganhar tempo — o tempo economizado ali é cobrado
com juros quando a falha aparece e não se sabe qual das quatro alterações a
causou. Migration aplicada nunca é editada; `drop policy` sempre em transação;
`add constraint` guardado por bloco `DO` sobre `pg_constraint`.

## 6 · Estrutura comercial

Migrations `0001`–`0006`, conforme `MODELO_DADOS.md` §8.

```
0001  app_role, profiles, auth_role/is_admin/has_role,
      set_updated_at, handle_new_user, prevent_profile_tampering, RLS
0002  must_change_password
0003  entity_status, enforce_inactivation_is_admin(),
      enforce_inactivation_is_manager_or_admin(), teams
0004  directors
0005  managers + FK circular de teams
0006  sellers
```

**Sem `managers.team_id`** (D-017). O vínculo de gerência é
`teams.current_manager_id`, muitos por gestor.

`profile_id` nulável em `directors`, `managers` e `sellers`: a pessoa da operação
pode não ter conta de acesso.

**Sem `sellers.manager_id`** também: o gestor do vendedor é o gestor atual da
equipe (`seller.team_id → team.current_manager_id`). Coluna própria divergiria na
primeira troca de gestor.

*Aceite:* CRUD das quatro entidades; ficha do gestor lista **todas** as equipes
que ele gerencia, não uma equipe de pertencimento (bug DE-040 da origem).

## 7 · `source_ref` e carga da estrutura comercial

Migration `0007`. `source_ref` nas quatro tabelas, com índice único parcial sobre
não nulos.

Motor de importação: copiar `types.ts`, `engine.ts`, `csv.ts`, `xlsx.ts`,
`grid.ts` e o utilitário `norm()` de `product-key.ts`. Specs de Agregados são
referência, não cópia.

Spec própria de estrutura comercial, adaptada de `import/sellers.ts`:

- deduplicação por **`source_ref`**, não por nome normalizado (D-004);
- nome é rótulo, não chave;
- gestor do vendedor resolvido pela equipe, não importado como coluna;
- equipe homônima sem `source_ref` vira erro de linha, nunca casamento em
  silêncio;
- `resolve(write: true)` restrito ao alvo da importação — nada de criar equipe ou
  consultor implicitamente.

Prévia obrigatória. Nada gravado antes da confirmação.

*Aceite:* importar o mesmo arquivo duas vezes não duplica nada; renomear uma
pessoa na origem e reimportar **atualiza**, não cria.

## 8 · Trilha cadastral e auditoria

Migration `0008`. **Antes de qualquer parte da `0009`** — as entidades da etapa 6
já admitem inativação, e trilha que nasce depois do dado nasce incompleta.

- `crm_record_status_history`
- Colunas `inactivated_at`, `inactivated_by`, `inactivation_reason` nas entidades
  da sprint (D-025)
- Uma função de trilha **por entidade**: `write_record_status_director()`,
  `write_record_status_manager()`, `write_record_status_team()`,
  `write_record_status_seller()`
- Cada uma: `security definer` + `set search_path = public` +
  `revoke execute from public, authenticated`
- Trigger declarada com `when (old.status is distinct from new.status)`
- `enforce_reactivation_is_admin()`

**Interface aplicação/banco do motivo** (D-025): `inactivation_reason` vem da
operação e é validado pela trigger (não vazio); `inactivated_at` e
`inactivated_by` são definidos exclusivamente pelo banco. O mesmo vale para o
motivo da reativação, que alimenta `reason` no histórico.

Tabela de histórico sem policy de INSERT, UPDATE ou DELETE — nem para
administrador.

*Aceite:* testes de ataque de `RLS_PERMISSOES.md` §6.2 falhando corretamente;
`UPDATE` que não altera status **não** gera linha; inativação sem motivo é
recusada pelo banco.

## 9 · Resolução hierárquica e RLS

Migration `0009`, aplicada depois da `0008`. Funções `current_seller_id()`,
`current_manager_id()`, `current_director_id()`, `scoped_seller_ids()`, mais as
policies com recorte.

Padrão obrigatório: `stable`, `security definer`, `set search_path = public`.

**União de escopos, nunca "primeiro papel encontrado"** (D-005). As três funções
de identidade podem retornar valor simultaneamente para o mesmo `auth.uid()`.

Índices que a função exige, sob pena de varredura por linha avaliada:
`sellers.team_id`, `sellers.profile_id`, `teams.current_manager_id`,
`managers.director_id`, `managers.profile_id`, `directors.profile_id`.

O caminho do gestor passa por `teams.current_manager_id`. **Não existe
`sellers.manager_id`** — seria a mesma armadilha de `managers.team_id` (D-017):
no dia em que a equipe trocar de gestor, a coluna divergiria em silêncio.

**Bateria completa de `RLS_PERMISSOES.md` §6.1 e §6.2 antes de qualquer tela
comercial.** É aqui que o projeto evita repetir o DE-025 da origem — leitura
ampla "provisória" que segue aberta três sprints depois.

Estado "sem vínculo" tem tela dedicada: *"Seu usuário ainda não está vinculado a
um consultor. Procure o gestor."* Zero linhas por falta de vínculo é
indistinguível de zero linhas por falta de dados.

*Aceite:* todos os cenários de §6.1 e §6.2 passando, incluindo o gate de cinco
usuários abaixo.

## 10 · Verificação

```
npm run verify   →  format:check · lint · typecheck · test · build
```

Mais a etapa do CI que falha o build se `SUPABASE_SERVICE_ROLE_KEY` aparecer em
`.next/static`.

Validação em navegador: desktop e tablet, foco, teclado, e os cinco estados —
`loading`, `empty`, `error`, `forbidden`, `success`.

## 11 · `ARQUITETURA.md`

Escrito **por último**, refletindo o que ficou implementado (A-006).

Afirmado: App Router, Supabase independente, Auth, RLS, Edge Functions, Vercel,
GitHub Actions, `middleware → x-user-profile → Server Components`, service role
isolada, motor de importação, `tokens.css`, estrutura comercial,
`scoped_seller_ids()`.

Marcado como **"a confirmar após configuração do ambiente"**: região do Supabase,
região e runtime da Vercel, IDs de ambiente, URLs, escopos Production/Preview/
Development, fornecedor de CNPJ.

Não fabricar informação de ambiente.

---

# Parada obrigatória para revisão — após a `0009`

**A revisão não é no fim da sprint.** É ao término da etapa 9, quando já existem
auth, estrutura comercial, `source_ref`, trilha cadastral, funções de escopo e
RLS — e ainda não existe nenhuma tela comercial nem `companies`.

É a melhor hora para pegar erro estrutural: depois disso, cada correção arrasta
telas junto.

Parar e entregar para revisão:

- resumo da execução, etapa por etapa, com o que divergiu do plano e por quê
- as migrations `0001` a `0009`, na íntegra
- resultado dos testes de RLS (§6.1) e dos testes de ataque (§6.2)
- resultado do gate de cinco usuários abaixo
- saída de `npm run verify`

**Não seguir para as etapas 10 e 11 antes do retorno da revisão.**

---

# Gate de fechamento

**Cinco usuários reais de teste.** A sprint não fecha sem esta bateria, e
`companies` não começa antes dela.

| Usuário | Vínculo | Escopo esperado |
| --- | --- | --- |
| Consultor | `sellers` | apenas o próprio `seller_id` |
| Gestor | `managers` | vendedores das equipes que gerencia (via `teams.current_manager_id`) |
| Diretor | `directors` + papel `gestor_adm` | vendedores das equipes dos gestores sob si |
| Administrador | — | todos os vendedores ativos |
| **Vínculo duplo** | `managers` **e** `sellers` | **união** dos dois conjuntos |

O quinto caso é o que prova a regra de D-005, e é o único que uma implementação
com "primeiro papel encontrado" reprova. Não é hipótese: DE-035 da origem nomeia
Rossi como diretor e gestor, Danilo como gestor e vendedor.

Verificar para cada um: leitura permitida, leitura negada fora do escopo,
escrita, tentativa de reatribuição fora do escopo, e o caso de usuário sem
vínculo.

---

# Fora de escopo desta sprint

Não iniciar, mesmo que pareça rápido:

```
companies · crm_contacts · crm_company_relationships
crm_opportunities · crm_activities · crm_tasks
carteiras · consulta de CNPJ · mapa · dashboard
```

Também não: instalar pacote novo sem decisão registrada; atualizar versão de
dependência; extrair pacote compartilhado; implementar offline, SSO ou
rastreamento contínuo; refatorar componente sem relação com a tarefa.

---

# Riscos desta sprint

| Risco | Mitigação |
| --- | --- |
| Escopo hierárquico sem precedente na origem | Testes de RLS antes das telas; gate de cinco usuários |
| `delete` do header `x-user-profile` esquecido na cópia | Teste automatizado específico (§6.3) |
| `revoke execute` esquecido numa função de trilha | Teste de ataque por função (§6.2) — a falta não quebra nada visível |
| Importação casando por nome em vez de `source_ref` | Aceite da etapa 7: reimportar após rename atualiza |
| `Permissions-Policy` copiado com `geolocation=()` | Corrigir na etapa 1, antes de existir código |
| Recursão de RLS nas funções de escopo | `security definer` + `search_path` fixo, padrão já validado |
| Custo por linha de `scoped_seller_ids()` | `stable` + índices da etapa 8 |
