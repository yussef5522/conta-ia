/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hotfix Export CSV+PDF (29/05/2026):
  // @react-pdf/renderer + @react-pdf/reconciler precisam ser
  // TRANSPILADOS pelo Next (não externalizados) pra que o JSX
  // dos builders bate com o reconciler interno do react-pdf.
  // Sem isso → Minified React error #31 (Objects are not valid
  // as a React child — found $$typeof|type|key|ref|props).
  // Referências: react-pdf issues #2444, #2865 (Next App Router).
  transpilePackages: ['@react-pdf/renderer', '@react-pdf/reconciler'],
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
