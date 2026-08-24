# CRM Comercial de Credenciamento Vegas

CRM da operação comercial de credenciamento da Vegas Card: prospecção, carteira,
Base Vegas, pós-credenciamento, oportunidades, atividades, agenda e visitas com
geolocalização.

Acesso por notebook e **tablet em campo**. Parte da Plataforma Vegas.

> **Estado:** Sprint 1 em andamento. Fundação do repositório e fundação visual
> concluídas; autenticação, banco e telas comerciais ainda não.

## Documentação

| Documento | Assunto |
| --- | --- |
| `CLAUDE.md` | orientação de trabalho — aponta para as fontes canônicas |
| `docs/sprints/SPRINT-1.md` | ordem de execução autorizada da fase atual |
| `docs/DECISOES.md` | decisões fechadas, com rationale (D-001 a D-027) |
| `docs/MODELO_DADOS.md` | entidades, colunas, índices, constraints |
| `docs/RLS_PERMISSOES.md` | matriz de papéis e resolução de escopo |
| `docs/VEGAS-PLATFORM-UI-STANDARD.md` | fonte normativa visual |
| `docs/IDENTIDADE_VISUAL.md` | o que está implementado da identidade |
| `docs/DIVERGENCIAS_BASE.md` | o que não copiar do sistema de origem |

## Stack

```
Next.js 14.2 (App Router) · TypeScript strict · Node 22
Tailwind 3.4.17 — VERSÃO FIXA
Supabase: Postgres · Auth · RLS · Edge Functions
Vercel · GitHub Actions · Vitest · Playwright
```

Sem ORM. Tipos de banco gerados em `src/types/database.ts`.

## Começando

```bash
nvm use                 # Node 22, conforme .nvmrc
npm install
cp .env.example .env.local   # preencher — ver abaixo
npm run dev
```

Verificação completa, a mesma que o CI roda:

```bash
npm run verify          # format:check · lint · typecheck · test · build
```

O catálogo de componentes fica em `/dev/componentes`. Ele é **fail-closed**: só
responde fora de produção (`VERCEL_ENV` em `preview` ou `development`); em
qualquer outro caso, inclusive com a variável ausente, responde 404.

---

## Variáveis de ambiente

As variáveis vivem em **três lugares que não se comunicam entre si**. Preencher
um não preenche os outros, e o sintoma de esquecer um deles aparece longe da
causa — build verde e 500 em runtime, ou login que funciona local e falha em
preview.

| Lugar | Para quê | Como se preenche |
| --- | --- | --- |
| **`.env.local`** | máquina do desenvolvedor | `cp .env.example .env.local`, à mão. Não vai para o Git |
| **Vercel** | build e runtime da aplicação | painel do projeto → Settings → Environment Variables, **nos três escopos** (Production, Preview, Development) separadamente |
| **GitHub Actions Secrets** | CI: build e testes de RLS | Settings → Secrets and variables → Actions |

`.env.example` é o template versionado: nomes, comentários e valores de exemplo,
**nenhum segredo real**. Quando uma variável nova entrar, ela entra lá primeiro —
é o único lugar onde a lista completa fica visível para quem chega depois.

### Quem precisa do quê

| Variável | `.env.local` | Vercel | GitHub | Observação |
| --- | :---: | :---: | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | sim | sim | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | sim | sim | pública por desenho — a proteção é a RLS |
| `NEXT_PUBLIC_SITE_URL` | sim | sim | sim | difere por escopo; alimenta o redirect do e-mail de recuperação |
| `SUPABASE_SERVICE_ROLE_KEY` | **não** | **não** | **não** | ver abaixo |
| `SUPABASE_PROJECT_REF` | sim | não | não | só o CLI usa |
| `SUPABASE_ACCESS_TOKEN` | sim | não | não | credencial de conta do CLI |
| `SUPABASE_DB_PASSWORD` | sim | não | não | só para acesso direto ao banco; `db:push` não é usado (D-031) |
| `SUPABASE_TEST_*` | não | não | sim | projeto de teste descartável |
| `CNPJ_*` | — | — | — | vazias até A-001 (Sprint 2) |

### A service role não mora no repositório

`SUPABASE_SERVICE_ROLE_KEY` ignora a RLS por completo. No CRM ela existe em **um
único lugar**: os secrets da Edge Function, definidos por
`supabase secrets set` — onde `admin-create-user` a lê, dentro do ambiente da
própria função.

Ela **não** entra em `.env.local`, **não** entra nas variáveis da Vercel e
**não** entra nos secrets do GitHub. Nunca com prefixo `NEXT_PUBLIC_`, nunca em
caminho de request do Next.

O CI tem uma etapa que falha o build se a string aparecer em `.next/static`.
Isso é rede de segurança, não autorização: o desenho é ela nunca chegar perto do
bundle.

---

## Banco de dados

Projeto Supabase **novo e independente** do Painel ADM (D-001): sem schema
compartilhado, sem Auth compartilhada. Região `sa-east-1`, a mesma da Vercel
(`gru1`) — latência entre regiões multiplica por round-trip.

Configuração local e do CLI em `supabase/config.toml`.

### Uma migration por vez, pelo SQL Editor

Regra permanente (D-021). Não é preferência de estilo: quando quatro alterações
sobem juntas e a quarta falha, ninguém sabe qual delas causou o quê.

As migrations são aplicadas **colando o arquivo no SQL Editor do painel**
(D-031). `db push` não é usado, e os scripts correspondentes não existem no
`package.json` de propósito.

```
1. o arquivo entra em supabase/migrations/, em ordem numérica
2. cole o conteúdo no SQL Editor e execute
3. execute o script correspondente de supabase/checks/ — somente leitura
4. toda linha da saída precisa sair com status OK
5. só então a próxima migration
```

**O banco não conhece o histórico de migrations.** A tabela que o CLI usa para
isso permanece vazia, então `supabase migration list` reportaria "nada aplicado"
mesmo com o banco inteiro construído. `supabase/migrations/` é a **única** fonte
da ordem aplicada. Se um dia o projeto migrar para o CLI,
`supabase migration repair --status applied <versão>` reconstrói o histórico sem
reexecutar nada.

**O script de verificação é o que substitui a confirmação do `db push`.** Ele lê
o catálogo do Postgres — colunas, tipos, defaults, constraints, índices,
`security definer`, `search_path`, triggers, RLS e policies — e compara com o
modelo. "Apliquei" vira "apliquei e aqui está a prova".

**Migration aplicada nunca é editada.** Correção é migration nova. As demais
regras — `drop policy` sempre em transação, `add constraint` guardado por bloco
`DO` sobre `pg_constraint`, nenhuma policy de DELETE — estão em `CLAUDE.md` e em
`docs/DECISOES.md`.

Cada RLS ganha espelho em `supabase/policies/<tabela>.sql`, para o estado das
policies ser legível sem abrir o painel.

O CLI do Supabase é **devDependency com versão exata** (D-028) — `npm install`
já o traz, não é preciso instalar nada globalmente.

### Ambiente local

`npm run db:start` sobe o Supabase local e **exige Docker**. É opcional: o
desenvolvimento pode apontar direto para o projeto hospedado. Quem usar o local
gera tipos com `db:types:local`.

---

## Testes

```bash
npm run test             # unidade e componente (Vitest)
npm run test:e2e         # ponta a ponta (Playwright)
```

Os **testes de RLS são a fronteira de segurança** (D-018), não cobertura extra.
Rodam contra um projeto Supabase descartável, sob demanda, pelo workflow
`rls-integration` — nunca contra produção. Sem eles, uma migration futura quebra
a matriz de permissões em silêncio.

## Deploy

Produção: **https://sistema-de-gest-o-para-equipe-comer.vercel.app**

| Ajuste | Valor |
| --- | --- |
| Framework Preset | **Next.js** |
| Root Directory | `./` |
| Build / Install / Output | padrão, sem override |
| Node.js Version | **22.x** |
| Function Region | **`gru1`** (São Paulo) |

Preset em "Other" produz 404 com build limpo e log de runtime vazio — sintoma
que não aponta para a causa.

**A região não é preferência.** O Supabase está em `sa-east-1`, e toda rota do
CRM é `ƒ (Dynamic)`: o middleware valida a sessão a cada request, o que
significa uma ida ao banco por request. Funções fora de São Paulo somam latência
a cada uma delas, sem nada em troca.

**Node 22 é declarado em `engines`, mas fixe no painel também.** A Vercel às
vezes respeita o campo e às vezes não.

### Depois de trocar a URL de produção

Duas coisas param de funcionar em silêncio se você esquecer:

1. **Vercel** — `NEXT_PUBLIC_SITE_URL` e **redeploy**. Variável `NEXT_PUBLIC_*`
   é embutida no build; mudar sem redeploy não muda nada.
2. **Supabase → Authentication → URL Configuration** — Site URL e Redirect URLs.
   Sem isso o link do e-mail de recuperação é recusado no retorno:

   ```
   Site URL:  https://sistema-de-gest-o-para-equipe-comer.vercel.app

   Redirect URLs:
     https://sistema-de-gest-o-para-equipe-comer.vercel.app/auth/callback
     https://<projeto>-*.vercel.app/auth/callback     ← curinga para previews
     http://localhost:3000/auth/callback
   ```

O `additional_redirect_urls` do `supabase/config.toml` vale só para o stack
local (`supabase start`), não para o projeto hospedado.
