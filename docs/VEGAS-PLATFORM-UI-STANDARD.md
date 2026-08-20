[VEGAS-PLATFORM-UI-STANDARD (2).md](https://github.com/user-attachments/files/31279975/VEGAS-PLATFORM-UI-STANDARD.2.md)
# VEGAS PLATFORM UI STANDARD

**Padrão visual, estrutural e de experiência para sistemas internos**

> **Documento normativo**
> Este padrão deverá ser utilizado como referência oficial em todos os sistemas internos da Vegas. Cada projeto poderá adaptar o conteúdo funcional, mas não deverá criar uma identidade visual paralela.

| **Versão**            | 1.0                                                              |
|-----------------------|------------------------------------------------------------------|
| **Data**              | 03/08/2026                                                       |
| **Aplicação inicial** | Painel Rede Vegas Ativa                                          |
| **Base visual**       | Logo oficial + VEGAS-DESIGN-SYSTEM.md + padrão de login aprovado |

## 1. Objetivo e alcance

Este documento estabelece a linguagem visual e de experiência dos sistemas internos da Vegas Card. Seu objetivo é garantir que diferentes aplicações pareçam módulos de uma mesma plataforma, com identidade, navegação, componentes, comportamento e qualidade consistentes.
- Aplicável a sistemas de Gestão de Rede, Agregados, Comercial, Credenciamento, Logística, Financeiro, Parceiros e módulos futuros.
- As regras visuais são compartilhadas; as regras de negócio continuam específicas de cada sistema.
- O documento não substitui a documentação funcional ou técnica de cada projeto.
- Mudanças no padrão devem ser versionadas e propagadas de forma controlada.

> **Princípio central**
> O usuário deve conseguir alternar entre sistemas Vegas e reconhecer imediatamente a mesma plataforma, sem precisar reaprender navegação, formulários, tabelas ou padrões de feedback.

## 2. Filosofia de interface
- Clareza antes de decoração.
- Cores claras e superfícies brancas como base.
- A marca identifica navegação e autoria; status operacionais utilizam cores semânticas próprias.
- Dados e ações críticas devem ser legíveis em ambiente administrativo, em campo e em monitor de parede.
- A interface deve parecer estável, discreta e profissional, evitando modismos visuais que envelheçam rapidamente.

## 3. Identidade visual oficial

A paleta é derivada do logo oficial Vegas. As superfícies e textos utilizam azul-tinta em vez de cinza neutro, preservando a percepção de marca mesmo em telas com pouca cor.

| **Grupo**        | **Token**     | **Hex**  | **Uso**                                         |
|------------------|---------------|----------|-------------------------------------------------|
| Marca primária   | Brand 500     | `#4D56A1` | Botão primário, link, item ativo                |
| Marca escura     | Brand 800     | `#2C3164` | Painel institucional, títulos de alto contraste |
| Violeta          | Brand 400     | `#6E68AE` | Início do gradiente e elementos de marca        |
| Rosé             | Rose 400      | `#9E7A9C` | Meio do gradiente; uso controlado               |
| Pêssego          | Peach 400     | `#D69086` | Fim do gradiente; uso decorativo restrito       |
| Fundo            | Background    | `#F5F5FA` | Fundo geral da aplicação                        |
| Superfície       | Surface       | `#FFFFFF` | Cards, modais e tabelas                         |
| Texto            | Ink           | `#1C1F3B` | Texto principal                                 |
| Texto secundário | Ink Secondary | `#494D6E` | Texto de apoio                                  |

### 3.1 Correções obrigatórias antes da replicação
- Alterar o token Peach 600 de `#A85C4E` para aproximadamente `#9E5445`, garantindo contraste AA sobre Peach 50.
- Criar o token `--vg-border-field` próximo de `#8E90AD` para bordas de inputs, atingindo contraste mínimo de 3:1.
- Manter label visível permanente em formulários; placeholder nunca substitui rótulo.
- Eliminar a nomenclatura ambígua text-ink-muted. Utilizar ink-secondary ou muted conforme a função.
- Evitar espelhos manuais de tokens. Quando houver brand.ts ou JSON, criar teste de sincronização com a fonte canônica.

### 3.2 Gradiente institucional

Gradiente oficial: 90 graus, `#6E68AE` em 0%, `#9E7A9C` em 52% e `#D69086` em 100%. Deve ser utilizado apenas como assinatura visual discreta, normalmente em faixa de 2 a 3 px.
- Permitido: topo da tela de login, item ativo da sidebar, progresso e etapa atual.
- Proibido: fundo de card, botão principal, KPI, cabeçalho extenso ou qualquer área grande.

## 4. Tipografia

| **Papel** | **Família** | **Peso** | **Uso**                                 |
|-----------|-------------|----------|-----------------------------------------|
| Display   | Outfit      | 400–600  | Títulos, cards e KPIs                   |
| Interface | Inter       | 400–600  | Formulários, tabelas, texto e navegação |

### 4.1 Escala tipográfica oficial

| **Token**  | **Tamanho / linha** | **Uso**                               |
|------------|---------------------|---------------------------------------|
| Display XL | 32 px / 40 px       | Título de login ou tela institucional |
| H1         | 24 px / 32 px       | Título principal de página            |
| H2         | 20 px / 28 px       | Título de seção                       |
| H3         | 16 px / 24 px       | Título de card                        |
| Body       | 14 px / 22 px       | Texto principal                       |
| Body Small | 13 px / 20 px       | Tabela e texto secundário             |
| Caption    | 12 px / 18 px       | Metadado, legenda e apoio             |

Valores monetários, percentuais, protocolos e quantidades em tabelas devem utilizar algarismos tabulares.

## 5. Espaçamento, forma e profundidade
- Escala de spacing: 4, 8, 12, 16, 24, 32, 40, 48 e 64 px.
- Padding padrão de card: 24 px no desktop e 16 px no mobile.
- Gap padrão entre campos: 16 px; entre seções: 32 px.
- Raio: 6 px pequeno, 10 px padrão, 14 px grande.
- Card: branco, borda de 1 px, sombra quase imperceptível.
- Evitar card dentro de card. Agrupamentos internos devem usar espaçamento, divisor ou fundo discreto.

## 6. Layout oficial da plataforma

Aplicações autenticadas devem adotar a mesma arquitetura de navegação: sidebar, topbar, breadcrumb, cabeçalho da página e área de conteúdo.

1.  Sidebar com logo, módulos e agrupadores.

2.  Topbar com contexto, pesquisa opcional, notificações e perfil.

3.  Breadcrumb acima do título.

4.  Título, descrição curta e ações principais.

5.  KPIs ou resumo operacional.

6.  Conteúdo principal: mapa, tabela, formulário, gráfico ou fila de trabalho.

### 6.1 Sidebar
- Largura recomendada: 248 px expandida e 72 px recolhida.
- Logo por componente único, nunca por caminho de imagem solto.
- Item ativo identificado por fundo Brand 50, texto Brand 700 e faixa vertical de gradiente de 3 px.
- Agrupadores em corpo pequeno, peso 600 e caixa alta.
- No mobile, substituir por navegação compacta ou drawer.

### 6.2 Topbar
- Altura recomendada: 64 px.
- Ações à direita; contexto e breadcrumb à esquerda.
- Não transformar a topbar em painel de botões.
- Em telas operacionais, mostrar estado de sincronização e última atualização.

## 7. Padrão de login

A tela de Gestão ADM de Produtos Agregados aprovada pelo usuário será a referência visual para os demais projetos.
- Desktop dividido em duas áreas: institucional à esquerda e autenticação à direita.
- Painel institucional em Brand 700/800, com título do sistema, mensagem de confidencialidade e uso interno.
- Área de autenticação sobre fundo claro, com logo, nome do sistema, texto de apoio, campos e botão primário.
- Faixa de gradiente de 2–3 px no topo.
- No mobile, ocultar ou compactar o painel institucional; formulário ocupa a largura útil.
- Manter labels visíveis, botão Mostrar senha, mensagem de erro próxima ao campo e versão no rodapé.

> **Padrão obrigatório**
> O layout do login permanece igual entre projetos. Alteram-se somente o nome do sistema, texto institucional, versão e eventualmente os recursos de autenticação.

## 8. Cabeçalho de página
- Breadcrumb.
- Título H1.
- Descrição de uma ou duas linhas.
- Ação primária no canto direito.
- Ações secundárias em menu ou botões neutros.
- Nunca inverter a ordem entre breadcrumb e título.

## 9. Dashboards e KPIs
- Dashboard gerencial: KPIs, gráficos, tabela e ações rápidas.
- Dashboard operacional: KPIs compactos, mapa ou fila de trabalho em destaque e alertas laterais.
- KPIs devem conter rótulo, valor, contexto temporal e comparação quando houver.
- Não usar todas as cores da marca em KPIs. A maior parte deve ser neutra; cor semântica somente para sinalizar situação.
- Números devem ser legíveis a distância quando o dashboard estiver em monitor de parede.

## 10. Cards
- Título à esquerda e ações à direita.
- Sem gradiente de fundo.
- Sem sombra pesada.
- Sem bordas decorativas múltiplas.
- Conteúdo alinhado em grid e com espaçamento consistente.
- Cards clicáveis devem possuir estado hover e foco visível.

## 11. Botões

| **Variante** | **Aparência**              | **Uso**                     | **Regra**                              |
|--------------|----------------------------|-----------------------------|----------------------------------------|
| Primário     | Brand 500 com texto branco | Ação principal              | Uma por área de decisão                |
| Secundário   | Fundo branco e borda forte | Ação alternativa            | Sem competir com a primária            |
| Neutro       | Fundo claro                | Ações de apoio              | Uso recorrente                         |
| Perigo       | Danger                     | Excluir, bloquear, cancelar | Exigir confirmação quando irreversível |
| Texto        | Sem caixa                  | Ação discreta               | Evitar em operações críticas           |

## 12. Formulários
- Label sempre visível acima do campo.
- Borda de campo utiliza `--vg-border-field`.
- Ajuda contextual abaixo do campo; erro no mesmo local, em linguagem objetiva.
- Campos relacionados agrupados por seção, sem excesso de modais.
- Ações principais no final do formulário e, em formulários longos, barra fixa opcional.
- Alvos de toque mínimos de 44 px no mobile.
- Não usar placeholder como única instrução.

## 13. Tabelas e listas
- Cabeçalho com fundo Surface Muted e texto Ink Secondary.
- Colunas numéricas alinhadas à direita; status e datas centralizados quando curtos.
- Pesquisa, filtros, exportação e paginação seguem o mesmo componente.
- A linha inteira pode ser clicável quando leva ao detalhe, mas deve existir affordance visual.
- Ações por registro ficam no fim da linha ou em menu contextual.
- No mobile, converter para cards resumidos ou tabela com rolagem controlada.

## 14. Badges e estados

Marca e status não podem compartilhar o mesmo significado. Violeta indica Vegas e navegação; status utiliza escala semântica.

| **Categoria** | **Exemplos**               | **Cores**           |
|---------------|----------------------------|---------------------|
| Sucesso       | Ativo, concluído, aprovado | `#E4F4EE` / `#1F7A5C` |
| Atenção       | Pendente, aguardando       | `#FDF3E2` / `#9A6410` |
| Perigo        | Erro, cancelado, bloqueado | `#FBEAEC` / `#B03A45` |
| Informação    | Em trânsito, informativo   | `#F0F0F8` / `#434B8F` |
| Neutro        | Rascunho, encerrado        | `#EEEEF4` / `#5A5E7A` |
| Parcial       | Estado intermediário       | `#F7F0F6` / `#7A5A78` |
| Suspenso      | Cortesia ou suspensão      | `#FBF0ED` / `#9E5445` |

## 15. Modais, drawers e confirmações
- Modal pequeno para confirmação; drawer para edição contextual; página completa para fluxos longos.
- Título, descrição, conteúdo e rodapé com ações.
- Ação de perigo à direita e secundária à esquerda ou imediatamente antes.
- Fechar com Esc quando seguro; bloquear fechamento acidental em formulários com alteração não salva.
- Nunca empilhar modais.

## 16. Feedback, loading e estados vazios
- Skeleton quando a estrutura da tela é conhecida.
- Spinner somente para ações curtas e localizadas.
- Toast para confirmação transitória; erros importantes permanecem visíveis na tela.
- Empty state deve explicar por que não há dados e qual é o próximo passo.
- Forbidden state não deve parecer erro técnico.
- Estados offline e dados desatualizados devem ser explícitos.

## 17. Padrão para mapas
- Mapa é ferramenta operacional, não decoração.
- Marcadores comunicam por cor, ícone e contorno; nunca somente por cor.
- Legenda sempre visível ou acessível.
- Filtros por produto, cidade, status e equipe ficam próximos ao mapa.
- Cluster obrigatório em áreas densas.
- Painel lateral exibe detalhes, ações e histórico do ponto selecionado.
- Localização do consultor deve possuir estado de precisão, atualização e permissão.

## 18. Central de monitoramento
- Rota própria em modo de tela cheia, sem sidebar.
- Tipografia ampliada para leitura a aproximadamente 3 metros.
- Relógio de última atualização e indicador de dados desatualizados.
- Renovação silenciosa de sessão.
- Realtime com fallback para atualização periódica.
- Prioridades ordenadas visualmente e também por texto e ícone.
- Evitar excesso de movimento; atualizações devem ser discretas.

## 19. Responsividade

| **Contexto**           | **Prioridade**            | **Comportamento**                                      |
|------------------------|---------------------------|--------------------------------------------------------|
| Desktop administrativo | Densidade e produtividade | Sidebar, tabelas, filtros e múltiplas colunas          |
| Tablet                 | Consulta e supervisão     | Menus compactos e painéis adaptáveis                   |
| Mobile em campo        | Ação com uma mão          | Botões 44 px, fluxo linear, câmera e geolocalização    |
| Monitor de parede      | Leitura à distância       | Tela cheia, tipografia grande, sem interação constante |

## 20. Acessibilidade
- Contraste mínimo WCAG AA para texto e 3:1 para limites de componentes interativos.
- Foco visível em todos os controles.
- Navegação completa por teclado no desktop.
- Labels e nomes acessíveis em ícones e botões.
- Não comunicar status apenas por cor.
- Respeitar prefers-reduced-motion.
- Tamanho de toque mínimo de 44 px no mobile.
- Tabelas com cabeçalhos semânticos e leitura linear possível.

## 21. Ícones, imagens e logo
- Biblioteca padrão: Lucide.
- Não misturar Lucide, Font Awesome, Heroicons ou outras bibliotecas no mesmo sistema.
- Logo acessado por componente único, com variantes completa, compacta e monocromática.
- Caminhos de ativos ficam centralizados em configuração de marca.
- Priorizar SVG oficial. O PNG atual poderá ser usado provisoriamente até obtenção do vetor oficial.

## 22. Padrões de página

### 22.1 CRUD

7.  Lista com filtros e ação Novo.

8.  Formulário ou detalhe com seções claras.

9.  Confirmação de exclusão ou inativação.

10. Histórico quando a entidade for operacional ou auditável.

### 22.2 Analítica

11. Filtros de período e escopo.

12. KPIs.

13. Gráficos.

14. Tabela detalhada.

15. Exportação e definição de última atualização.

### 22.3 Operacional

16. Fila priorizada.

17. Contexto e responsável.

18. Ação principal visível.

19. SLA ou tempo decorrido.

20. Linha do tempo e evidências.

## 23. Componentes oficiais
- VegasLogo
- VegasAppShell
- VegasSidebar
- VegasTopbar
- VegasPageHeader
- VegasButton
- VegasInput
- VegasSelect
- VegasTextarea
- VegasCard
- VegasKpi
- VegasBadge
- VegasTable
- VegasFilters
- VegasModal
- VegasDrawer
- VegasToast
- VegasEmptyState
- VegasErrorState
- VegasSkeleton
- VegasTimeline
- VegasMap
- VegasAlert
- VegasMonitorCard

Os nomes acima representam o catálogo conceitual. A implementação pode utilizar nomes sem o prefixo Vegas dentro de uma biblioteca compartilhada, desde que a documentação e a API sejam consistentes.

## 24. Regras de implementação
- Hexadecimal somente no arquivo canônico de tokens.
- Componente não referencia diretamente caminho de logo.
- Estados semânticos não utilizam cores de marca por conveniência.
- Tokens de CSS são a fonte canônica; JSON e TypeScript devem ser gerados ou testados contra ela.
- Novos componentes devem incluir estados default, hover, focus, active, disabled, loading e erro quando aplicável.
- Toda mudança relevante deve incluir atualização da documentação e teste visual.

## 25. Governança e sincronização
- Enquanto houver poucos sistemas, utilizar documento versionado e registrar a versão adotada em cada repositório.
- Com três ou mais sistemas ativos, migrar para pacote privado @vegas/tokens.
- Quando a biblioteca de componentes estabilizar, avaliar pacote @vegas/ui.
- Mudança de token ocorre primeiro na fonte canônica, com registro da decisão.
- Projetos consumidores atualizam por versão, nunca por cópia silenciosa.

## 26. Aplicação ao Painel Rede Vegas Ativa
- Login segue o padrão institucional já aprovado no sistema de Agregados.
- Dashboard operacional prioriza mapa, fila de atenção, visitas e alertas.
- Status de estabelecimentos mantém cores operacionais próprias, sem substituir a paleta institucional.
- Central de monitoramento utiliza modo de parede com leitura à distância.
- Formulários de atendimento, visita e ocorrência reutilizam o mesmo padrão de campos, histórico e anexos.
- O projeto deverá registrar em seu CLAUDE.md a obrigatoriedade de obedecer a este documento.

## 27. Checklist de conformidade

**☐** Logo entra por componente único.

**☐** Tokens corrigidos de contraste foram aplicados.

**☐** Não existem hexadecimais em componentes.

**☐** Outfit e Inter estão configuradas.

**☐** Escala de spacing e tipografia foi adotada.

**☐** Login segue o padrão oficial.

**☐** Sidebar e topbar seguem a arquitetura oficial.

**☐** Botões possuem variantes padronizadas.

**☐** Inputs usam border-field e label visível.

**☐** Status não usam cor de marca.

**☐** Tabelas, modais e empty states usam componentes compartilhados.

**☐** Responsividade foi validada em desktop, mobile e monitor.

**☐** Contraste AA e foco por teclado foram testados.

**☐** Documentação registra a versão do padrão consumida.

## 28. Controle de versão

| **Versão** | **Data**   | **Mudança**                                   | **Responsável**                      |
|------------|------------|-----------------------------------------------|--------------------------------------|
| 1.0        | 03/08/2026 | Criação do padrão oficial da Plataforma Vegas | Gestão Comercial / Projetos Internos |

> **Uso recomendado**
> Adicionar este arquivo à pasta docs/ de cada projeto e registrar sua versão no CLAUDE.md. Em novos projetos, entregar este documento ao Claude antes da geração da interface.
