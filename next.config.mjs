/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hotfix Export CSV+PDF (29/05/2026) — 3ª tentativa:
  // TODOS os @react-pdf/* em serverExternalPackages pra forçar
  // require() runtime único. Mais reduções:
  // - tentativa 1 (só @react-pdf/renderer external) → React error #31 persistiu
  //   porque o reconciler dependent ainda era bundled (referência diferente)
  // - tentativa 2 (transpilePackages) → TypeError 'reading S' no
  //   Yoga/layout engine (bundling parcial quebra runtime nativo)
  // - agora: TODOS @react-pdf/* externos garante 1 só instância via
  //   require() do node_modules, sem duplicação React/reconciler
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/reconciler',
    '@react-pdf/render',
    '@react-pdf/layout',
    '@react-pdf/textkit',
    '@react-pdf/font',
    '@react-pdf/image',
    '@react-pdf/primitives',
    '@react-pdf/stylesheet',
    '@react-pdf/svg',
    '@react-pdf/pdfkit',
    '@react-pdf/fns',
    '@react-pdf/types',
    'yoga-layout',
  ],
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
