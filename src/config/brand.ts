/**
 * Configuração central da identidade visual.
 *
 * Regra: nenhum caminho de logo, cor de marca ou texto institucional
 * deve ser escrito diretamente em páginas ou componentes. Tudo passa por aqui
 * (textos e caminhos) ou pelos tokens CSS em src/styles/tokens.css (cores).
 */

export const brand = {
  app: {
    name: 'CRM Credenciamento',
    fullName: 'CRM Comercial de Credenciamento Vegas',
    shortName: 'CRM Credenciamento',
    version: '0.1.0',
    description: 'CRM da operação comercial de credenciamento da Vegas Card.',
  },

  company: {
    name: 'Vegas',
    legalName: 'Vegas Card',
    site: 'https://www.vegascard.com.br',
    supportEmail: 'suporte.credenciamento@vegascard.com.br',
  },

  logos: {
    /** Selo completo, colorido — login, splash e topo do menu expandido. */
    full: '/brand/logo-vegas.png',
    /** Somente o símbolo — uso no menu recolhido e no cabeçalho mobile. */
    icon: '/brand/logo-vegas-icon.png',
    favicon: '/brand/favicon.png',
    appleTouchIcon: '/brand/apple-touch-icon.png',
  },

  /**
   * Espelho dos tokens CSS, para os casos em que o valor precisa sair do CSS:
   * theme-color do navegador, geração de PDF, gráfico em canvas, e-mail
   * transacional.
   *
   * A fonte da verdade continua sendo tokens.css, e o espelho não é mantido por
   * convenção: `brand.test.ts` lê tokens.css e compara valor a valor. Espelho
   * manual sem teste é o defeito que o UI Standard §3.1 proíbe replicar — e
   * este arquivo fica fora do alcance da regra de lint que barra hexadecimal,
   * que cobre apenas src/components e src/app.
   */
  colors: {
    primary: '#4D56A1',
    primaryStrong: '#3A4183',
    primarySoft: '#6E68AE',
    secondaryRose: '#9E7A9C',
    secondaryPeach: '#D69086',
    background: '#F5F5FA',
    surface: '#FFFFFF',
    border: '#E5E5F0',
    ink: '#1C1F3B',
    muted: '#6B6F8C',
    gradient: 'linear-gradient(90deg, #6E68AE 0%, #9E7A9C 52%, #D69086 100%)',
  },

  content: {
    loginTitle: 'CRM Comercial de Credenciamento Vegas',
    loginSubtitle: 'Acesse com seu e-mail corporativo.',
    footer: 'Vegas Card — uso interno',
    confidentialityNotice:
      'Ambiente interno. Os dados exibidos são confidenciais e o acesso é registrado.',
  },
} as const

export type Brand = typeof brand
