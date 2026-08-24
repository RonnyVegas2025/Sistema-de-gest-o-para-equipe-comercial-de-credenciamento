# Camada 3b — a barreira que o dublê não alcança

Aceite 4 da etapa 1 da Sprint 2. Roteiro para você executar; eu não alcanço o
Supabase deste ambiente.

---

## O que está sendo provado, e por que não dá para testar com dublê

A Edge Function `admin-create-user` tem três camadas de barreira. As duas
primeiras — a tela exigir administrador e a Server Action revalidar — são
conveniência: quem chamar a API direto passa por cima das duas.

**A terceira é a única que não dá para contornar.** A função revalida a sessão
(3a) e o papel (3b) por conta própria, antes de instanciar a service role.

O teste automatizado de `src/lib/users/actions.test.ts` cobre o que acontece
**depois** que a função responde — que um 403 vira mensagem, que nenhum caminho
de erro carrega a senha. Ele não pode provar que a função **responde** 403,
porque nesse teste a função é um dublê que responde o que eu mandei responder.

Só a função real prova a função real.

---

## Pré-requisitos

- `consultor@vegascard.com.br` já trocou a senha (feito na validação da
  Sprint 1). Você vai precisar da senha atual dele.
- A aplicação no ar, para abrir o console do navegador em um contexto onde as
  requisições saem do domínio certo.

Nada aqui usa a `sb_secret_...`. Se algum passo parecer pedi-la, pare: é erro
meu, não uma necessidade do teste.

---

## Passo 1 — Obter um token de NÃO-administrador

Abra `https://sistema-de-gest-o-para-equipe-comer.vercel.app` no navegador,
abra o console (F12 → Console) e cole:

```js
const r = await fetch(
  'https://oywwcwkkwsrgzgkegifn.supabase.co/auth/v1/token?grant_type=password',
  {
    method: 'POST',
    headers: {
      apikey: 'sb_publishable_IrYJqpYf4Qdvazse3yQjLQ_2EnVqrk0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'consultor@vegascard.com.br',
      password: 'A-SENHA-ATUAL-DELE',   // <- troque
    }),
  },
)
const sessao = await r.json()
console.log('status', r.status, '| tem token:', Boolean(sessao.access_token))
window.TOKEN_CONSULTOR = sessao.access_token
```

**O que colar de volta:** apenas a linha do `console.log`.

**O que eu espero ver:**

```
status 200 | tem token: true
```

**Não cole o token.** Ele é uma credencial de sessão viva; o que interessa é
que ele existe.

**O que seria um problema:** `400` significa senha errada ou usuário
inexistente — confira qual senha o `consultor@` tem hoje.

---

## Passo 2 — Invocar a função com esse token

Na mesma aba, em seguida:

```js
const r = await fetch(
  'https://oywwcwkkwsrgzgkegifn.supabase.co/functions/v1/admin-create-user',
  {
    method: 'POST',
    headers: {
      apikey: 'sb_publishable_IrYJqpYf4Qdvazse3yQjLQ_2EnVqrk0',
      Authorization: `Bearer ${window.TOKEN_CONSULTOR}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      full_name: 'Teste de Barreira',
      email: 'barreira@vegascard.com.br',
      role: 'administrador',
    }),
  },
)
console.log(r.status, await r.text())
```

Repare no payload: ele pede um usuário **`administrador`**. Se a barreira não
existisse, um consultor teria acabado de criar um administrador — que é
exatamente o cenário que a camada 3b existe para impedir.

**O que colar de volta:** a linha inteira do `console.log`.

**O que eu espero ver:**

```
403 {"error":"forbidden"}
```

**O que seria um problema, em ordem de gravidade:**

| Resposta | O que significa |
| --- | --- |
| `200` | **Grave.** A camada 3b não existe. Um consultor acabou de criar um administrador. Pare tudo e me diga. |
| `401 no_session` | O token não chegou. Provavelmente o passo 1 falhou — reveja o `tem token: true`. |
| `500 missing_env` | A função está sem secret. O corpo diz qual. Não é sobre a barreira. |
| `404` | Nome da função diferente de `admin-create-user`. |

---

## Passo 3 — O controle contra vacuidade

**Este passo é o que impede o teste de passar por acidente.** Uma função quebrada
que respondesse `403` a todo mundo passaria nos passos 1 e 2 com louvor, e a
barreira estaria "provada" sem existir.

Não precisa de console: **crie um usuário pela tela `/usuarios`**, logado como
`admin@`. É o aceite 1 da etapa, e serve de controle.

**O que colar de volta:** se o usuário foi criado e se a senha temporária
apareceu no diálogo.

**O que eu espero ver:** usuário criado, diálogo com a senha, e — ao consultar
`select email, role, must_change_password from public.profiles order by email;`
— a linha nova com `must_change_password = true`.

Se o passo 2 der `403` e o passo 3 der certo, a barreira distingue quem pode de
quem não pode. É isso que se queria provar.

---

## Limpeza

O passo 2 não cria nada — ele é recusado. O passo 3 cria um usuário de verdade:
se foi descartável, remova-o pelo painel de Auth (Authentication → Users), o que
também remove o `profiles` por cascata.

O `barreira@vegascard.com.br` do passo 2 **não deve existir**. Se existir, o
passo 2 não foi recusado — e isso é o achado, não a limpeza.
