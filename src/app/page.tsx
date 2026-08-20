/**
 * Raiz da aplicação. Nasce mínima na etapa 1 e vira o redirect para `/inicio`
 * na etapa 2, quando o shell Vegas e a rota interna passam a existir.
 */
export default function Home() {
  return (
    <main>
      <h1>CRM Comercial de Credenciamento Vegas</h1>
      <p>Fundação do repositório instalada. Interface a partir da etapa 2.</p>
    </main>
  )
}
