/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hotfix Export CSV+PDF (29/05/2026):
  // @react-pdf/renderer tem React empacotado internamente. Quando o
  // Next bundla server-side, o $$typeof dos React elements criados
  // pelo route handler (usando o React do projeto) não bate com o
  // $$typeof esperado pelo react-pdf bundled — Minified React error #31.
  // Marcar como external resolve: react-pdf usa o mesmo React do
  // projeto via node_modules.
  serverExternalPackages: ['@react-pdf/renderer'],
  async redirects() {
    return [
      // Hotfix 5.0.4.0a-fix — DRE migrado pra /relatorios. 301 permanent
      // pra atualizar bookmarks / histórico de browser.
      {
        source: '/empresas/:id/dre',
        destination: '/empresas/:id/relatorios/dre-gerencial',
        statusCode: 301,
      },
      {
        source: '/empresas/:id/dre-gerencial',
        destination: '/empresas/:id/relatorios/dre-gerencial',
        statusCode: 301,
      },
    ]
  },
}

export default nextConfig
