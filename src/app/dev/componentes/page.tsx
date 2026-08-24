import dynamic from 'next/dynamic'

// Import dinâmico: o catálogo vira um chunk separado, fora do bundle principal.
// O gate vive no layout do segmento (src/app/dev/layout.tsx), que cobre esta e
// futuras rotas de /dev.
const Catalog = dynamic(() => import('./catalog').then((mod) => mod.Catalog))

/** Catálogo de componentes — ferramenta de trabalho. Gate no layout de /dev. */
export default function ComponentesPage() {
  return <Catalog />
}
