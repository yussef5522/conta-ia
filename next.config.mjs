/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⛔ DEPLOY BLUE-GREEN (26/08) — o build NUNCA escreve por cima do `.next` que o
  // pm2 está servindo. `scripts/deploy.sh` passa `NEXT_DIST_DIR=.next-builds/<sha>`,
  // o build cai lá, e só depois de PROVADO pronto o `.next` (um SYMLINK) passa a
  // apontar pra ele — troca atômica.
  //
  // A causa do incidente de 26/08: o build escreveu em `.next` enquanto o processo
  // velho servia; quem acessou naqueles segundos recebeu HTML apontando pra chunks
  // que ainda não existiam (CSS 404 às 16:35:00, 200 às 16:36:56). Com `next start`
  // sem a env, `distDir` continua `.next` — que agora é o symlink.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
      // Sprint Unificar Sócios (03/06/2026) — /pessoas-vinculadas e
      // /empresas/:id/pontes viraram /empresas/:id/socios.
      // 301 permanent pra atualizar bookmarks.
      // Mantemos /pontes/[id] (detalhe global) e /pontes/nova (legacy) sem redirect.
      // /pessoas-vinculadas vai pra rota global /socios que resolve empresa do cookie.
      {
        source: '/pessoas-vinculadas',
        destination: '/socios',
        statusCode: 301,
      },
      {
        source: '/empresas/:id/pontes',
        destination: '/empresas/:id/socios',
        statusCode: 301,
      },
    ]
  },
}

export default nextConfig
