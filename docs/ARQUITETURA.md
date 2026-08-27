# Arquitetura — CRM Comercial de Credenciamento Vegas

Escrito por último (A-006), descrevendo **o que ficou implementado** ao fim da
Sprint 1 — não o que se pretende implementar.

Se algo aqui divergir do código, o código venceu e este documento está
desatualizado. Duas seções merecem leitura antes de qualquer suposição: a **§9**,
que lista o que **não** existe apesar de parecer que existiria, e a **§10**, com
o que ainda não foi verificado contra ambiente real.

---

## 1. Forma geral

```
navegador
   │
   ▼
Next.js 14.2 · App Router · TypeScript strict · Node 22
   │  middleware (Edge) — valida sessão, saneia e anexa x-user-profile
   ▼
Server Components / Server Actions
   │  supabase-js com a chave publishable + sessão do usuário
   ▼
Supabase — Postgres 17 · Auth · RLS
   │
   └── Edge Function admin-create-user (service role, isolada)
```

Sem ORM. Sem camada de repositório. As Server Actions falam com o Supabase
diretamente, e **a RLS é a fronteira de segurança** — não o código da aplicação.

## 2. Projeto Supabase independente (D-001)

Projeto próprio, sem acoplamento com o Painel ADM de Produtos Agregados: sem
schema compartilhado, sem Auth compartilhada, sem sincronização de banco.

| | |
| --- | --- |
| Região | **`sa-east-1`** — South America (São Paulo) · confirmado |
| Postgres | **17.6.1.155** · confirmado |
| Referência do projeto | vive em `SUPABASE_PROJECT_REF`, no `.env.local` |

O custo aceito é autenticação duplicada (D-007) e cadastro comercial replicado
por importação (D-004).

## 3. Autenticação e a ponte para o render

O middleware roda em toda requisição e faz, **nesta ordem**:

```
1. remove x-user-profile recebido do cliente        ← D-029, antes de tudo
2. cria o client Supabase e chama getUser()         ← nada entre os dois
3. decide rota: pública, redirect, ou protegida
4. em rota protegida, lê profiles UMA vez e anexa o perfil validado ao header
```

**O passo 1 vale para toda requisição**, em todos os ramos — não só nos de rota
protegida. O sistema de origem saneia apenas naquele ramo, e por isso uma rota
pública que leia perfil (o `/dev`, cujo layout exige administrador) é alcançável
com header forjado. Aqui não.

**O passo 2 não admite lógica no meio**: a renovação do token depende de
`getUser()` ser chamado imediatamente após a criação do client.

O render lê `x-user-profile` e **não repete** `getUser` nem a consulta a
`profiles` — um de cada por navegação, não dois. `src/lib/auth/session.ts` tem o
fallback para contextos sem o header.

`src/middleware.test.ts` cobre §6.3 e foi validado por mutação: revertido ao
padrão da origem, três testes reprovam.

## 4. Onde a service role vive — e onde não vive

**Um lugar só:** os secrets da Edge Function `admin-create-user`.

Não está no `.env.local`, não está nas variáveis da Vercel, não está nos secrets
do GitHub, e `src/lib/env.ts` **não a lê** — o `serverEnv()` do sistema de origem
não foi replicado (D-030), porque um schema no runtime do Next exigindo a chave
convidaria a cadastrá-la onde o desenho diz que ela não deve estar.

Verificado: a string `SUPABASE_SERVICE_ROLE_KEY` não aparece em `.next/static`
**nem em `.next/server`**. O CI tem uma etapa que falha o build se ela aparecer no
bundle client — rede de segurança, não autorização.

A Edge Function não confia no gate do Next: revalida a sessão e o papel por conta
própria, porque é a única camada que não pode ser contornada chamando a API
direto.

## 5. Banco — estrutura implementada

```
profiles ──┬── directors ──┐
           ├── managers ───┤ director_id
           ├── teams ──────┤ current_manager_id
           └── sellers ────┘ team_id

crm_record_status_history   trilha cadastral, imutável
user_directory (view)       id + nome, para vínculo de perfil
```

**Duas ausências deliberadas, ambas provadas em teste:**

- **`managers.team_id` não existe** (D-017). Um gestor gerencia várias equipes;
  o vínculo é `teams.current_manager_id`.
- **`sellers.manager_id` não existe.** O gestor do consultor é o gestor atual da
  equipe. Trocar o gestor da equipe muda a resposta sem tocar em `sellers`; uma
  coluna própria divergiria naquele instante.

**Encerramento ≠ inativação** (D-022). `valid_to`, `active_to` e `left_at` são
encerramento operacional, feitos pelo gestor, e o histórico continua contando.
`status = 'inativo'` é erro cadastral, é do administrador, exige motivo e gera
trilha.

## 6. Trilha cadastral — imutável no banco

`crm_record_status_history` não tem policy de INSERT, UPDATE nem DELETE. **Nem
para administrador.** Ausência de botão na interface não é imutabilidade;
ausência de policy é.

A gravação acontece por **uma função `security definer` por entidade**, cada uma
com o `scope` fixo no corpo e sem parâmetro — um gravador genérico anularia a
imutabilidade, bastando chamá-lo com os argumentos certos.

```sql
security definer + set search_path = public
revoke execute ... from public, authenticated   ← os DOIS
```

Revogar só de `authenticated` é inócuo: o grant implícito de `PUBLIC` sustenta o
privilégio, e nada dá sinal, porque a trilha continua gravando. Está medido em
`RLS_PERMISSOES.md` §5.6.

O SELECT é restrito aos escopos da Sprint 1. Escopo de sprint futura nasce
invisível até ter policy própria.

## 7. Escopo hierárquico

`scoped_seller_ids()` concentra a regra e combina os ramos por **`union`**:

```
administrador → todos os ativos
consultor     → o próprio
gestor        → consultores das equipes que gerencia
diretor       → consultores das equipes dos gestores da sua diretoria
sem vínculo   → conjunto vazio, sem erro
```

**União, nunca "primeiro papel encontrado"** (D-005). Medido: com uma
implementação em `case`, os casos de consultor, gestor, diretor e administrador
ficam **idênticos**, e só o de vínculo duplo cai. É por isso que o gate tem cinco
usuários.

### D-018 — o recorte está APLICADO; ainda NÃO foi EXERCITADO

*Registro corrigido em 26/08/2026. A formulação anterior dizia "D-018 fechou", e
era forte demais.*

**O que está provado.** A migration `0013` levou o recorte a
`crm_company_relationships`, aplicada no banco real com 46 checagens `OK` — três
delas sobre o recorte:

```
as três policies chamam scoped_seller_ids        3 = 3
o predicado incide sobre responsible_seller_id   3 = 3
ramo de gestão para responsável nulo             3 = 3
```

Está nas TRÊS policies, não só na de leitura — `SELECT` recortado com `UPDATE`
aberto deixaria o consultor reatribuir para si um registro fora do escopo, e o
`SELECT` esconderia a operação depois de feita. Cinco mutações reprovam o
script.

**Ressalva de 26/08/2026: a mutação "só o `UPDATE` perdendo o recorte" era
vácua.** Media com `update ... where id = <linha invisível>`, e essa forma
devolve 0 linhas **com ou sem** recorte na escrita, porque a policy de SELECT
filtra a linha antes de a de UPDATE ser consultada. O recorte existe — a
estrutura confirma —, mas aquela prova não provava. Refeita na etapa 5c-0 com
`update` **sem `where`**: 1 linha com recorte, 3 sem.

**O que NÃO está provado, e é a parte que importa.** Aquelas três linhas leem o
`polqual` no catálogo do Postgres. Elas provam que a policy **existe** e que
**chama** `scoped_seller_ids()`. Não provam que ela **recorta** — nenhuma linha
foi lida por um consultor e negada a outro.

E não é só o script da `0013`:

| O que rodou | Como rodou | O que mediu |
| --- | --- | --- |
| `0013_verificacao.sql`, `0014_verificacao.sql` | SQL Editor, como dono | texto do predicado |
| gate de cinco usuários da Sprint 1, 8/8 `OK` | SQL Editor, como dono | `scoped_seller_ids()`, a função |
| tudo no cluster local | `psql` como `postgres` | idem — RLS ignorada |

**O dono do banco não é filtrado pela RLS.** Medido em 26/08/2026: no cluster
local, `set role authenticated` devolve `permission denied for table companies`,
porque o harness nunca reproduziu os grants que o Supabase configura. Nenhuma
asserção de RLS foi executada até hoje — nem aqui, nem no painel.

O gate de cinco usuários continua valendo pelo que ele mede: a **união** de
escopos contra "primeiro papel encontrado" (D-005), que é uma propriedade da
função. Isso não muda.

**Por que esta correção existe.** A diferença entre este sistema e o de origem
era ter provado. Em DE-025 o recorte do comercial foi adiado na Sprint 2 e
seguia aberto três sprints depois — a intenção existia. Declarar vitória sobre
uma verificação que não verifica é repetir DE-025 com documentação melhor, e o
custo é maior: aqui haveria uma linha escrita dizendo que está fechado.

**A prova real vem na etapa 5c-0 da Sprint 2**, quando o harness ganhar os
grants e a bateria de §6.1 puder rodar sob `authenticated`, com JWT por papel e
prova por mutação. Até lá, D-018 é **aplicada e não exercitada**.

## 8. Frontend

`tokens.css` é a fonte única de cor. Hexadecimal fora dele é erro de lint, com
uma exceção documentada: o espelho em `brand.ts`, para consumidores que não leem
CSS (`theme-color`, PDF, canvas), verificado valor a valor por `brand.test.ts`.

As cinco correções do UI Standard §3.1 foram aplicadas na cópia, com contraste
calculado — os dois valores antigos reprovavam de fato.

**Alvo de toque responsivo** (D-027): 44 px na base, densidade compacta a partir
de `lg:`. Confirmado em navegador — 40 px a 1440 px de largura, 44 px a 768 px.

O motor de importação (`engine`, `csv`, `xlsx`, `grid`) foi copiado; as specs
são próprias, deduplicando por `source_ref` e nunca por nome.

## 9. O que NÃO existe, apesar de parecer

| Parece existir | Não existe |
| --- | --- |
| Policies com recorte de escopo **verificadas** | as policies existem desde 25/08/2026 (`0013`, nas três) e o predicado está conferido no catálogo — mas **nenhuma nunca foi exercitada**: tudo rodou como dono, com RLS ignorada. Ver §7 |
| Telas comerciais | nenhuma. Só login, recuperação, troca de senha e `/inicio` |
| Tela de importação | Sprint 3 |
| Dados de estrutura comercial | as quatro tabelas estão vazias — a carga depende de exportação do Painel |
| `companies`, oportunidades, atividades, carteiras | Sprint 2 em diante |

**A regra que impede a primeira linha de virar dívida:** nenhuma tabela `crm_*`
é criada sem a sua policy com recorte **na mesma migration**, e o script de
verificação daquela migration confere isso. Ver a emenda a D-018.

## 10. Ambiente de execução

| Item | Estado |
| --- | --- |
| URL de produção | `https://sistema-de-gest-o-para-equipe-comer.vercel.app` |
| Framework preset | Next.js, root `./`, build padrão |
| Node | 22.x |
| Região das funções | `gru1` (São Paulo), casando com o `sa-east-1` do Supabase |
| Escopos de variáveis | Production, Preview e Development configurados |
| Supabase Auth | Site URL e Redirect URLs apontando para a URL acima |

Toda rota do CRM é `ƒ (Dynamic)` — o middleware valida a sessão a cada request,
o que significa uma ida ao Supabase por request. Daí a região das funções
acompanhar a do banco, e não ser detalhe de preferência.

### `NEXT_PUBLIC_SITE_URL` e o escopo Preview

A variável tem **um único consumidor**: o `redirectTo` do e-mail de recuperação
de senha, em `src/lib/auth/actions.ts`. O `/auth/callback` usa o `origin` do
próprio request, não a variável — o retorno depois da troca se autocorrige em
qualquer ambiente.

A URL de preview muda a cada deploy, então nenhum valor fixo está correto lá.
Preview recebe a URL de produção, e a consequência está registrada em vez de
descoberta depois: **pedir recuperação de senha a partir de um preview manda o
e-mail apontando para produção.** Recuperar senha a partir de preview não é caso
de uso; se um dia for, a correção é derivar o origin do header e deixar de ter
configuração para errar.

### Ainda em aberto

| Item | Estado |
| --- | --- |
| Fornecedor de consulta de CNPJ | A-001, Sprint 2 |
| Projeto Supabase de teste para RLS | será criado separado, descartável |

## 11. O que não foi verificado contra ambiente real

Distinto de §10: aqui o código existe, mas nunca rodou contra o Supabase.

| Item | Coberto por |
| --- | --- |
| Edge Function `admin-create-user`, criação de usuário | implantada e recusando anônimo (`401 no_session`); o caminho completo **não tem chamador** — não existe `/usuarios` nem Server Action que a invoque. A tela é da Sprint 2 |
| Persistência da importação | cliente dublado |
| `e2e/auth.spec.ts` | nada — nunca executado, e nenhum workflow o roda |

**Login, troca obrigatória de senha e bloqueio de usuário desativado saíram
desta lista.** Foram verificados contra a aplicação no ar em 24/08/2026 —
detalhe em `docs/sprints/SPRINT-1-REVISAO.md` §7.1.

**O gate de cinco usuários saiu desta lista.** Rodou contra o banco real em
24/08/2026, oito casos, todos OK — inclusive o de vínculo duplo, que devolveu as
duas origens somadas. Resultado em `docs/sprints/SPRINT-1-REVISAO.md` §5.1;
roteiro em `docs/sprints/SPRINT-1-GATE.md`.

As onze migrations, essas sim, foram aplicadas e verificadas contra o banco real:
**255 checagens**, todas OK.

## 12. Ordem para destravar

```
1. [x] implantar a Edge Function admin-create-user
2. [x] criar os cinco usuários e seus vínculos
3. [x] rodar o gate — supabase/checks/GATE_painel.sql
4. [x] criar o projeto na Vercel e preencher a §10
5. [x] validar login, troca obrigatória de senha e bloqueio de desativado
6. [ ] rodar e2e/auth.spec.ts contra a aplicação no ar — exige workflow próprio
       e um E2E_EMAIL que já tenha trocado a senha
7. [ ] Sprint 2: tela de usuários, o chamador que falta para a Edge Function
```
