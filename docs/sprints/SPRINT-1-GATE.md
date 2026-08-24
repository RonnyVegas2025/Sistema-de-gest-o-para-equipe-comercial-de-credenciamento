# SPRINT 1 — GATE CONTRA O BANCO REAL

Roteiro de execução no painel do Supabase. A Sprint 1 **não fecha** enquanto
este documento não tiver sido percorrido inteiro e a saída do passo 4 não
voltar com todas as linhas `OK`.

Tudo aqui é feito pelo painel — não há CLI, não há clone local (D-031).

---

## Antes de começar

**Uma ressalva honesta sobre este documento.** O ambiente onde ele foi escrito
não alcança `supabase.com` (bloqueio de rede de saída), então **não pude
conferir os rótulos e caminhos de menu do painel** contra a interface real. A
lógica, o SQL e os números esperados foram testados; os nomes de menu são o meu
melhor conhecimento e podem ter mudado de lugar numa atualização da interface.
Se um caminho não bater, o nome do que se procura está descrito junto — procure
pelo conteúdo, não pelo caminho, e me diga o que encontrou para eu corrigir o
documento.

**Sobre a `sb_secret_...`.** Ela entra **em um único lugar**: nos *secrets* das
Edge Functions (passo 1.3). Não vai para `.env.local`, não vai para a Vercel,
não vai para o GitHub Secrets, não vai para arquivo nenhum do repositório e não
volta para esta conversa. Se em algum momento eu pedir essa chave, a resposta
correta é não mandar e me perguntar por quê.

**Ordem.** Os passos dependem uns dos outros. O passo 3 para com erro se o 2 não
tiver sido feito; o passo 4 dá números errados se o 3 não tiver rodado.

```
1. Edge Function admin-create-user      (independente — pode ser feito antes ou depois)
2. Criar os cinco usuários              ← o gate depende disto
3. Seed da estrutura comercial          ← e disto
4. Gate                                  ← o que fecha a sprint
```

---

## Passo 1 — Edge Function `admin-create-user`

### 1.0 Por que ela não é pré-requisito do gate

A função **recusa qualquer chamador que já não seja `administrador`** (camada
3b, no próprio arquivo). Ela não consegue criar o primeiro administrador —
ovo e galinha. Por isso os cinco usuários do gate nascem no painel de Auth
(passo 2), que é menos peça em movimento, e a função é apenas **implantada e
testada** aqui.

O teste completo dela — criar usuário de verdade pela tela — exige uma sessão
autenticada, ou seja, a aplicação no ar. Isso fica para depois da Vercel. O que
dá para provar agora é que ela está implantada, roda, e recusa quem não tem
sessão. Que é a barreira que interessa.

### 1.1 Criar a função

Painel → **Edge Functions** → **Deploy a new function** → opção de criar
**pelo editor** (não pela CLI).

- Nome: **`admin-create-user`** — exatamente assim, sem maiúsculas e sem sufixo.
  O nome é a URL, e a Server Action chama por esse nome.

### 1.2 Colar o código

Cole o conteúdo **inteiro** de:

```
supabase/functions/admin-create-user/index.ts
```

Pegue direto do GitHub, na branch `sprint-1/fundacao`, pelo botão de copiar
conteúdo bruto do arquivo. Não digite e não edite: o arquivo já está escrito
como arquivo único justamente para ser colado sem montagem.

### 1.3 Os secrets — onde a `sb_secret_...` entra

Painel → **Edge Functions** → **Secrets** (em algumas versões aparece como
Project Settings → Edge Functions → Secrets, ou Project Settings → Functions).
É a tela de variáveis de ambiente das funções, com pares nome/valor.

Configure **três**:

| Nome do secret | Valor |
| --- | --- |
| `SERVICE_ROLE_KEY` | a chave `sb_secret_...` |
| `PUBLISHABLE_KEY` | `sb_publishable_IrYJqpYf4Qdvazse3yQjLQ_2EnVqrk0` |
| `PROJECT_URL` | `https://oywwcwkkwsrgzgkegifn.supabase.co` |

**Por que esses nomes e não `SUPABASE_SERVICE_ROLE_KEY`.** O Supabase injeta
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` sozinho em
toda Edge Function, e o prefixo `SUPABASE_` é **reservado** — o painel recusa
criar secret com esse nome. Só que os valores injetados são as chaves **legadas**
(JWT). Este projeto usa o formato novo (`sb_publishable_` / `sb_secret_`); se as
legadas estiverem desabilitadas, o valor injetado não autentica. Os três nomes
acima são alternativas que a função lê **com precedência** sobre os injetados,
justamente para esse caso.

Se o projeto ainda aceitar as chaves legadas, configurar os três não atrapalha —
a função usa os alternativos e ignora os injetados. Configurar é o caminho que
funciona nos dois cenários.

> A chave `sb_secret_...` você pega em Project Settings → **API Keys**. Ela fica
> mascarada e tem um botão de revelar. Copie de lá direto para o campo do
> secret; não passe por bloco de notas, não cole no chat.

### 1.4 Verificar

Ainda na tela da função, use o painel de teste (envio de uma requisição de
exemplo) e dispare **um POST sem cabeçalho `Authorization`**, corpo `{}`.

**O que colar de volta:** o código de status e o corpo da resposta.

**O que eu espero ver:**

```
401  {"error":"no_session"}
```

Isso prova três coisas de uma vez: a função está implantada, está rodando, e a
camada 3a (validação de sessão) recusa chamador anônimo antes de tocar em
qualquer coisa.

**O que seria um problema:**

- `500 {"error":"missing_env","missing":[...]}` → falta secret. A lista diz
  qual — foi por isso que ela existe. Volte ao 1.3.
- `404` → o nome da função saiu diferente de `admin-create-user`.
- `200` ou `403` → grave. Significaria que a função aceitou seguir sem sessão.
  Pare e me diga.

---

## Passo 2 — Criar os cinco usuários

Painel → **Authentication** → **Users** → **Add user** → **Create new user**.

Cinco vezes, com estes e-mails exatos (o seed do passo 3 procura por eles):

```
admin@vegascard.com.br
consultor@vegascard.com.br
gestor@vegascard.com.br
diretor@vegascard.com.br
duplo@vegascard.com.br
```

Para cada um:

- **Auto Confirm User: ligado.** Sem SMTP configurado, e-mail de confirmação não
  chega e o usuário fica preso.
- Senha: qualquer uma que atenda à política, a mesma para os cinco se quiser.
  Ela vale só para o teste de login depois do gate — o primeiro acesso vai
  exigir troca de qualquer forma (`must_change_password` nasce `true`, D-007).

**Não** preencha papel nem nome aqui. O papel é do passo 3; o nome vem do
`user_metadata` quando existe e não faz falta agora.

### 2.1 Conferir

SQL Editor → nova query → cole:

```sql
select p.id, p.email, p.role, p.is_active, p.must_change_password
from public.profiles p
order by p.email;
```

**O que colar de volta:** a tabela inteira.

**O que eu espero ver:** exatamente **cinco linhas**, uma por e-mail acima,
todas com `role = auditoria`, `is_active = true` e `must_change_password = true`.

`auditoria` está certo: é o papel de menor privilégio, com que a trigger
`handle_new_user` cria todo perfil. O passo 3 corrige.

**O que seria um problema:** menos de cinco linhas significa que a trigger
`handle_new_user` não disparou para alguém — o usuário existe em `auth.users`
mas não em `profiles`. Me diga qual faltou antes de seguir; não crie o perfil
à mão.

---

## Passo 3 — Seed da estrutura comercial

SQL Editor → nova query → cole o conteúdo **inteiro** de:

```
supabase/seed/gate_estrutura.sql
```

### O que ele monta

```
Diretoria do Gate ──── Gestor do Gate ──── Equipe do Gestor ──┬── Consultor do Gate  (usuário CONSULTOR)
   (usuário DIRETOR)                                          └── Consultor Colega
                    └── Gestor Duplo   ──── Equipe do Duplo  ──── Consultor do Duplo
                          (usuário DUPLO,
                           como gestor)

Diretoria de Fora ──── Gestor de Fora  ──── Equipe de Fora   ──┬── Consultor de Fora
   (sem conta)             (sem conta)                         └── Gestor Duplo     (usuário DUPLO,
                                                                                     como consultor)
Equipe Sem Gestor (vazia, sem gestor)
```

**O detalhe que faz o gate valer alguma coisa:** o usuário DUPLO é gestor da
"Equipe do Duplo" e consultor na "**Equipe de Fora**" — uma equipe que ele **não**
gerencia, em outra diretoria. Se ele fosse consultor da própria equipe, o
conjunto de gestor já o conteria e a união seria indistinguível de "primeiro
papel encontrado". Estando fora, a união é a **única** forma de ele enxergar a
si mesmo (D-005).

É idempotente: pode rodar de novo sem duplicar nada.

**Ele para com erro de propósito** se algum dos cinco usuários faltar, em vez de
montar meia estrutura — que é o jeito silencioso de o gate dar número errado e
ninguém saber por quê.

**O que colar de volta:** as **duas** tabelas que ele imprime no fim
(a contagem e o quadro de vínculos por e-mail).

**O que eu espero ver:**

```
o_que        | quantos
-------------+--------
perfis       |   5
diretorias   |   2
gestores     |   3
equipes      |   4
consultores  |   5
```

e, no quadro de vínculos:

| email | role | diretor_de | gestor_de | consultor_de |
| --- | --- | --- | --- | --- |
| admin@… | administrador | | | |
| consultor@… | comercial | | | Consultor do Gate |
| diretor@… | gestor_adm | Diretoria do Gate | | |
| duplo@… | gestor_adm | | Gestor Duplo | **Gestor Duplo** |
| gestor@… | gestor_adm | | Gestor do Gate | |

**A linha do `duplo@` é a que importa:** `gestor_de` e `consultor_de`
preenchidos ao mesmo tempo. Se um dos dois vier vazio, pare — o gate do passo 4
vai passar por vacuidade.

`diretor@` e `gestor@` com papel `gestor_adm` está certo e não é engano: não
existe papel `diretor`. Papel diz **o que** a pessoa faz; hierarquia diz **sobre
o quê** (D-005).

**O que seria um problema:**

```
ERROR: Usuários ausentes: <lista>. Crie-os antes (painel de Auth ou Edge
Function) e rode de novo.
```

Volte ao passo 2 e crie quem faltou. O erro é a proteção funcionando.

---

## Passo 4 — O gate

SQL Editor → nova query → cole o conteúdo **inteiro** de:

```
supabase/checks/GATE_painel.sql
```

Existem dois arquivos de gate no repositório e este é o do painel:
`supabase/checks/0009_gate_cinco_usuarios.sql` usa `\set` e vários
`begin`/`rollback`, o que só funciona no `psql` — o editor do painel mostra
apenas o resultado da última instrução. O `GATE_painel.sql` é **uma colagem só**
e devolve **uma tabela** com todos os casos já comparados com o esperado.

É somente leitura. A única escrita é uma tabela temporária, que morre com a
conexão.

**O que colar de volta:** a tabela inteira, as oito linhas, com a coluna `quem`.

**O que eu espero ver — todas as oito linhas com `status = OK`:**

| ordem | caso | esperado | obtido | quem |
| --- | --- | --- | --- | --- |
| 1 | consultor | 1 | 1 | Consultor do Gate |
| 2 | gestor | 2 | 2 | Consultor Colega, Consultor do Gate |
| 3 | diretor | 3 | 3 | Consultor Colega, Consultor do Duplo, Consultor do Gate |
| 4 | administrador | 5 | 5 | os cinco consultores |
| 5 | vínculo duplo | 2 | 2 | Consultor do Duplo, Gestor Duplo |
| 6 | sem vínculo | 0 | 0 | nenhum — e sem erro |
| 7 | fora do alcance do gestor | 3 | 3 | Consultor de Fora, Consultor do Duplo, Gestor Duplo |
| 8 | união conferida à mão | 2 | 2 | — |

Uma `NOTICE: schema "pg_temp" does not exist, skipping` na primeira execução é
esperada e inofensiva — é o `drop table if exists` de limpeza numa conexão que
ainda não tinha tabela temporária.

### Por que oito casos e não cinco

**O caso 5 é o único que uma implementação errada reprova.** Isto não é teoria:
substituí `scoped_seller_ids()` por uma versão "primeiro papel encontrado" no
banco de teste e rodei este mesmo arquivo. Resultado — os casos 1, 2, 3, 4, 6 e
7 passaram **idênticos**; só o 5 caiu de 2 para 1, e o 8 junto com ele. É por
isso que o quinto usuário existe, e por isso ele precisa estar vinculado a uma
equipe que não gerencia.

O **caso 7** existe porque um gate que só verifica o que se vê passa por
acidente numa função que devolve tudo. Ele prova a exclusão.

O **caso 8** soma os dois conjuntos **fora** da função e compara com o que ela
devolveu — conferência independente, não a mesma conta duas vezes.

O **caso 6** confirma que ausência de vínculo devolve conjunto vazio **sem
levantar erro**. Zero por falta de vínculo é indistinguível de zero por falta de
dados, e é a aplicação que separa os dois — daí a tela dedicada de `forbidden`.

### Se alguma linha vier `FALHA`

Não mexa em nada. Cole a tabela e me diga. As duas hipóteses são estrutura
diferente da do seed, ou resolução de escopo errada — e as duas precisam ser
investigadas, nenhuma se ignora. Correção de banco é migration nova, nunca
edição de migration aplicada — regra inviolável do `CLAUDE.md`.

---

## Depois do gate

Nesta ordem, e só depois de as oito linhas voltarem `OK`:

1. **Login e troca de senha obrigatória** — entrar com `consultor@`, confirmar o
   redirecionamento forçado para a troca de senha e que ele não escapa dela por
   URL direta.
2. **Bloqueio de usuário inativo** — `update public.profiles set is_active =
   false where email = 'consultor@vegascard.com.br';`, confirmar que a sessão
   deixa de passar no middleware, e reverter.
3. **Vercel** — variáveis de ambiente e primeiro deploy.
4. **Teste completo da Edge Function** — criar um usuário descartável pela tela,
   já com sessão de administrador, e conferir que ele nasce com
   `must_change_password = true`.
5. **PR da Sprint 1.**

O PR não é aberto antes disso. A sprint fecha contra o banco real, não contra o
`npm run verify`.
