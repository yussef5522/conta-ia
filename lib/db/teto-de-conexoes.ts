// O TETO DE POOL DO CLIENT LONGO DO APP (FASE 0 PASSO 5, 26/10/2026).
//
// ⚠️ MÓDULO PRÓPRIO, PURO, ZERO IMPORT — e não dentro do `lib/db.ts`, por um motivo
// concreto: aquele arquivo INSTANCIA o `PrismaClient` no topo, então um teste que o
// importasse abriria conexão. ***Regra que mora num arquivo que instancia client é regra
// que ninguém prova*** — e esta precisava ser provada, porque ela já quebrou o dev inteiro.

/**
 * Bancos que TÊM pool de conexão — os únicos em que `connection_limit` significa algo.
 *
 * ⛔⛔ ALLOWLIST, nunca denylist. A 1ª versão desta função mexia em QUALQUER URI e
 * destruiu a do SQLite do dev (ver `comTetoDeConexoes`). Protocolo novo/desconhecido cai
 * no lado que NÃO MEXE — o erro seguro é um teto de pool não declarado; o inseguro é a URI
 * do banco reescrita por uma função que não entende aquele protocolo.
 */
export const PROTOCOLOS_COM_POOL = new Set(['postgresql:', 'postgres:', 'mysql:'])

/**
 * Acrescenta `connection_limit` à URI SEM nunca imprimi-la.
 *
 * ⛔⛔⛔ SQLITE PASSA INTOCADO — e isto NÃO é preciosismo, é o defeito MEDIDO em 26/10:
 * `file:` é *special scheme* no WHATWG URL, então `new URL('file:./dev.db')` resolve o
 * caminho relativo CONTRA A RAIZ e devolve `file:///dev.db`. O engine passava a tentar
 * abrir `/dev.db` → `SQLITE_CANTOPEN (code 14)` → **198 arquivos de teste vermelhos de uma
 * vez, 1.474 testes, com cara de 198 defeitos de negócio**. Em produção (postgresql://) a
 * URI saía perfeita, então o estrago vivia SÓ no dev — a mesma classe do `contains`
 * case-sensitive (28/08): funciona num banco e falha calado no outro.
 *
 * ⚠️ E o SQLite não tem pool nenhum: `connection_limit` ali nunca teve o que limitar.
 *
 * ⚠️ Em QUALQUER falha devolve a URI ORIGINAL e segue (fail-soft): um teto de pool não
 * declarado é infinitamente melhor que o app não subir. E o catch NÃO imprime a exceção —
 * a mensagem do Prisma/URL vaza a URI COM A SENHA (a cicatriz de 07/10).
 */
export function comTetoDeConexoes(url: string | undefined, limite: number): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    if (!PROTOCOLOS_COM_POOL.has(u.protocol)) return url
    // Respeita um valor já declarado na própria URI — quem escreveu explicitamente manda.
    if (u.searchParams.has('connection_limit')) return url
    u.searchParams.set('connection_limit', String(limite))

    // ⚠️⚠️ CINTO SOBRE SUSPENSÓRIO, E ELE É INALCANÇÁVEL HOJE — medido pela REGRA 11 em
    // 26/10: repondo o defeito (removendo estas 2 linhas), os 19 testes ficam VERDES.
    // A allowlist acima já barra tudo que não é postgres/mysql, e nesses três o round-trip
    // do WHATWG preserva host e pathname POR CONSTRUÇÃO. Não é trava em funcionamento.
    //
    // ⭐ Ele FICA pelo dia em que alguém acrescentar um protocolo a `PROTOCOLOS_COM_POOL`
    // cujo round-trip NÃO seja lossless: aí a reescrita deixa de ser "um teto de pool" e
    // passa a ser OUTRA URI, e a função desiste em vez de entregar o banco errado.
    // (Mesmo desenho do `IS NOT NULL` redundante dos CHECKs de 14/10.)
    const orig = new URL(url)
    if (orig.host !== u.host || orig.pathname !== u.pathname) return url
    return u.toString()
  } catch {
    return url
  }
}
