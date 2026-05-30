/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hotfix Export CSV+PDF (29/05/2026): MANTIDO serverExternalPackages
  // pra @react-pdf/renderer (necessário pra evitar bundling do Yoga
  // WASM). Outros sub-pacotes saem implícitos via deps tree.
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
