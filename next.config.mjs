/**
 * Cabeçalhos de segurança aplicados a todas as respostas. O sistema é interno:
 * não deve ser embutido em iframe, nem ter o tipo de conteúdo adivinhado, e o
 * referrer sai restrito.
 *
 * Permissions-Policy libera `geolocation=(self)` (D-020): o CRM registra visitas
 * com geolocalização, e `geolocation=()` faz o navegador negar antes do prompt —
 * o sintoma na tela fica indistinguível de "usuário negou". Câmera e microfone
 * seguem desligados enquanto não houver requisito de anexo por foto.
 *
 * @type {import('next').NextConfig}
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()',
  },
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
