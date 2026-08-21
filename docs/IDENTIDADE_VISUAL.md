# Identidade visual

Descreve **o que está implementado** no repositório após a etapa 2 da Sprint 1 —
não o que se pretende implementar. Mesma regra do `ARQUITETURA.md` (A-006): se
divergir do código, o código venceu e este documento está desatualizado.

Fonte normativa: `VEGAS-PLATFORM-UI-STANDARD.md`. Fonte canônica dos valores:
`src/styles/tokens.css`.

---

## Procedência

Tokens, componentes e ativos de marca foram **copiados e adaptados** (D-012) do
Painel ADM de Produtos Agregados, branch
`sprint-3/relatorios-e-estrutura-comercial`. Não é reimplementação: o usuário
deve reconhecer a mesma Plataforma Vegas nos dois sistemas.

A cópia **não foi literal**. O UI Standard §3.1 lista cinco defeitos conhecidos
do sistema de origem; replicá-los seria herdar o problema junto com a solução.
As cinco correções estão aplicadas e travadas por teste — a seção seguinte diz
onde.

---

## As cinco correções da §3.1

| # | O que era na origem | O que é aqui | Onde |
| --- | --- | --- | --- |
| 1 | `--vg-peach-600: #a85c4e` — 4,36:1 sobre Peach 50, reprova AA | `#9e5445` — **4,93:1**, aprova | `tokens.css` |
| 2 | borda de campo usava `--vg-border` (`#e5e5f0`) — 1,25:1, muito abaixo de 3:1 | `--vg-border-field: #8e90ad` — **3,11:1** | `tokens.css`, `tailwind.config.ts`, `input.tsx` |
| 3 | rótulo permanente já existia, sem garantia | rótulo permanente **testado**; placeholder nunca é o único rótulo | `form-field.tsx`, `conformidade.test.tsx` |
| 4 | `text-ink-muted` — o nome não dizia se era hierarquia ou apoio | eliminado: `ink-secondary` para prosa subordinada, `muted` para metadado | toda a `ui/`, `tailwind.config.ts` |
| 5 | `brand.colors` era espelho manual de 11 hexadecimais, sem verificação | espelho mantido, sincronia **testada** valor a valor contra `tokens.css` | `brand.test.ts` |

Os contrastes acima foram calculados pela fórmula WCAG 2.1, não estimados.

**Por que a 5 não removeu o espelho.** `brand.colors` existe para os consumidores
que não leem CSS: `themeColor` do navegador, PDF, gráfico em canvas, e-mail
transacional. Removê-lo quebraria esses casos. O §3.1 não proíbe o espelho —
proíbe o espelho *manual*. E há um agravante que o teste resolve: a regra de lint
que barra hexadecimal cobre `src/components` e `src/app`, **não** `src/config`.
Sem o teste, `brand.ts` seria o único ponto do sistema onde uma cor pode divergir
em silêncio.

---

## Origem da paleta

Amostrada do logo oficial, não escolhida por aproximação:

| Token | Hex | Onde aparece no logo |
| --- | --- | --- |
| `--vg-brand-500` | `#4d56a1` | tipografia "vegas" e moldura do selo |
| `--vg-brand-400` | `#6e68ae` | início do gradiente do cartão |
| `--vg-rose-400` | `#9e7a9c` | meio do gradiente |
| `--vg-peach-400` | `#d69086` | fim do gradiente |

Superfícies e texto derivam do mesmo matiz para não brigar com a marca: fundo
`#f5f5fa`, card `#ffffff`, linha `#e5e5f0`, texto `#1c1f3b`, apoio `#6b6f8c`.

## A fita

O gradiente `brand-400 → rose-400 → peach-400` é o único elemento decorativo do
sistema, sempre em 2–3 px, e só indica estado: item ativo do menu, etapa corrente
de um cadastro, progresso de carregamento, topo do login.

Nunca como fundo de card, de botão primário, de cabeçalho extenso ou de KPI.

## Cor com significado

Marca (violeta) identifica a Vegas e o estado ativo da navegação. **Não é cor de
status.** Status usa a escala semântica:

| Situação | Fundo | Texto |
| --- | --- | --- |
| Ativo, ganho, aprovado | `--vg-success-bg` | `--vg-success-fg` |
| Aguardando retorno ou documento | `--vg-warning-bg` | `--vg-warning-fg` |
| Perdido, cancelado, inativado | `--vg-danger-bg` | `--vg-danger-fg` |
| Informativo | `--vg-brand-50` | `--vg-brand-600` |
| Rascunho, encerrado | `--vg-neutral-bg` | `--vg-neutral-fg` |

As faixas `rose` e `peach` existem nos tokens, herdadas da origem, mas **ainda
não têm situação atribuída no CRM** — o domínio comercial da Sprint 4
(oportunidades, motivos de perda) é quem vai decidir se precisam de significado
próprio. Até lá, não usar por conta própria.

## Tipografia

- Display (`--vg-font-display`): **Outfit**, via `next/font/google`. Restrita a
  títulos de página, títulos de card e números de KPI.
- Interface (`--vg-font-sans`): **Inter**. Todo o resto — rótulos, tabelas,
  formulários, navegação, texto de apoio.
- Números em tabelas, valores e percentuais recebem `.vg-numeric`
  (`tabular-nums`), para as colunas alinharem por dígito.

Escala oficial em `VEGAS-PLATFORM-UI-STANDARD.md` §4.1.

## Alvo de toque

Responsivo, conforme **D-027**: 44 px na base, densidade compacta a partir de
`lg:`. O checkbox mantém o quadrado de 16 px por convenção visual e ganha área
de toque pelo padding do rótulo, não inchando o quadrado.

Vale para `button`, `input`, `select`, `date-input`, `password-input`,
`phone-input`, `currency-input`, `percent-input`, `checkbox` e células de tabela.

---

## Regras estruturais

1. Hexadecimal só existe em `src/styles/tokens.css`. Componentes usam classes
   Tailwind (`bg-brand-50`, `text-ink-secondary`, `text-muted`) ou `var(--vg-*)`.
   A única exceção é o espelho de `brand.ts`, coberto por `brand.test.ts`.
2. Caminho de imagem só existe em `src/config/brand.ts`. Nenhum
   `<img src="/brand/...">` direto em página.
3. O logo só entra na tela via `BrandLogo` — garante `alt` correto, proporção
   fixa e troca de variante sem caçar arquivo.
4. Card branco, borda de 1 px, raio de 10 px, sombra quase imperceptível. Sem
   sombra pesada, sem borda dupla, sem card dentro de card.
5. Piso não negociável: contraste AA, foco visível pelo teclado
   (`--vg-focus-ring`), `prefers-reduced-motion` respeitado, alvo de toque de
   44 px em tela de toque.

---

## O que existe hoje

```
src/
├── config/brand.ts               nome, textos, caminhos, espelho das cores
├── config/brand.test.ts          sincronia do espelho com tokens.css (§3.1)
├── styles/tokens.css             tokens CSS — fonte da verdade
├── app/globals.css               importa tokens.css
├── app/layout.tsx                fontes Outfit/Inter, metadata, theme-color
├── app/dev/                      catálogo, com gate de ambiente fail-closed
├── components/brand/             BrandLogo · SidebarBrand · BrandSplash
└── components/ui/                28 componentes + índice
```

Os 28 componentes são a lista de `src/components/ui/` da branch de referência,
contada no próprio diretório.

`public/brand/`: `logo-vegas.png` (selo completo), `logo-vegas-icon.png`
(símbolo), `favicon.png` (64 px), `apple-touch-icon.png` (512 px).

### O catálogo

`/dev/componentes` renderiza a biblioteca inteira com valores fictícios. O gate
vive em `src/app/dev/layout.tsx` e é **fail-closed**: só renderiza com
`VERCEL_ENV` em `preview` ou `development`; qualquer outro valor — inclusive
ausente — responde 404. Verificado nos três casos.

A segunda barreira (sessão + perfil administrador) entra na **etapa 4**, junto
com a autenticação. Nenhuma rota sob `/dev` expõe dado: o catálogo renderiza
componentes com valores inventados.

## O que ainda não existe

O **shell** — `app-shell`, `sidebar`, `topbar`, `mobile-nav`, `user-menu` — não
foi copiado nesta etapa, apesar de constar da lista original da etapa 2. Todos
dependem de `@/lib/auth/session`, `@/config/navigation` ou `@/types/database`,
que nascem nas etapas 4 e 6. Copiá-los agora exigiria stubs, e stub criado para
destravar etapa sobrevive e apodrece. Migram na **etapa 4**, com as dependências
reais.

Pelo mesmo motivo, `src/app/page.tsx` ainda não redireciona para `/inicio`: a
rota vive em `(app)/`, cujo layout exige perfil autenticado.

## Limitações herdadas dos ativos

Todos os ativos derivam de um único PNG colorido enviado pela empresa; não há
arquivo vetorial. Consequências, para registro:

1. Tudo é raster. O favicon a 64 px e o símbolo do menu recolhido a 32 px são
   onde a perda aparece primeiro em tela de alta densidade.
2. A moldura arredondada do símbolo é **interpretação**, não versão aprovada
   pelo manual da marca. Se o manual definir proporção ou área de proteção
   diferentes, o símbolo precisa ser refeito.
3. Não há variante monocromática ou para fundo escuro — nenhuma superfície do
   sistema é escura hoje.

**Ação recomendada:** solicitar ao marketing os arquivos `.svg` ou `.ai`. Trocar
PNG por SVG é mudança de arquivo, não de código: `brand.ts` aponta os caminhos e
`BrandLogo` faz o resto.

## Pendências

- Confirmar o nome exibido no login. O texto atual, "CRM Comercial de
  Credenciamento Vegas", está em `brand.content.loginTitle`.
- Definir se o menu recolhido guarda preferência por usuário (cookie) ou por
  sessão — decisão da etapa 4, quando o shell chegar.
- Atribuir significado às faixas `rose` e `peach`, ou removê-las, quando o
  domínio comercial da Sprint 4 existir.
