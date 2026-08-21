/**
 * PostCSS para Tailwind v3. Não usar @tailwindcss/postcss (v4):
 * o tailwind.config.ts do kit está no formato v3.
 */
const config = {
  plugins: {
    // Inlina os @import (tokens.css) antes do Tailwind, para que o
    // @layer base do tokens.css encontre o @tailwind base de globals.css.
    'postcss-import': {},
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
