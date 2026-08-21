/**
 * Raiz da aplicação. Nasce mínima na etapa 1 e vira o redirect para `/inicio`
 * na etapa 4, junto com o shell Vegas e a barreira de autenticação que
 * protege a rota interna.
 */
export default function Home() {
  return (
    <main>
      <h1>CRM Comercial de Credenciamento Vegas</h1>
      <p>Fundação do repositório instalada. Interface a partir da etapa 2.</p>
    </main>
  )
}
