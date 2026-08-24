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

A função está pronta e provada. **O enforcement não existe ainda** — ver §9.

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
| Policies com recorte de escopo | as cinco tabelas de §5.3 nascem na Sprint 2. A função existe; o enforcement não |
| Telas comerciais | nenhuma. Só login, recuperação, troca de senha e `/inicio` |
| Tela de importação | Sprint 3 |
| Dados de estrutura comercial | as quatro tabelas estão vazias — a carga depende de exportação do Painel |
| `companies`, oportunidades, atividades, carteiras | Sprint 2 em diante |

**A regra que impede a primeira linha de virar dívida:** nenhuma tabela `crm_*`
é criada sem a sua policy com recorte **na mesma migration**, e o script de
verificação daquela migration confere isso. Ver a emenda a D-018.

## 10. A confirmar após configuração do ambiente

Não fabricado. O que ainda não foi observado:

| Item | Estado |
| --- | --- |
| Região e runtime da Vercel | **projeto não criado.** Previsto `gru1`, para casar com `sa-east-1` |
| URL de produção | não existe |
| Escopos Production / Preview / Development | não configurados |
| IDs de ambiente da Vercel | não existem |
| Fornecedor de consulta de CNPJ | A-001, Sprint 2 |
| Projeto Supabase de teste para RLS | será criado separado, descartável |

## 11. O que não foi verificado contra ambiente real

Distinto de §10: aqui o código existe, mas nunca rodou contra o Supabase.

| Item | Coberto por |
| --- | --- |
| Login, troca de senha, bloqueio de desativado | nada — nunca executado |
| Edge Function `admin-create-user`, criação de usuário | implantada e recusando anônimo (`401 no_session`); o caminho completo exige sessão de administrador |
| Persistência da importação | cliente dublado |
| `e2e/auth.spec.ts` | nada — nunca executado |

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
4. [ ] criar o projeto na Vercel e preencher esta seção §10
5. [ ] validar login, troca obrigatória de senha e bloqueio de desativado
6. [ ] rodar e2e/auth.spec.ts contra a aplicação no ar
```
