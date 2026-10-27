// ⛔⛔⛔ O TETO DE POOL NÃO PODE TOCAR A URI DO SQLITE (defeito medido em 26/10).
//
// A 1ª versão de `comTetoDeConexoes` mexia em QUALQUER URI. `file:` é *special scheme* no
// WHATWG URL, então `new URL('file:./dev.db')` resolve o caminho relativo CONTRA A RAIZ DO
// SISTEMA e devolve `file:///dev.db`. O engine passava a tentar abrir `/dev.db` →
// `SQLITE_CANTOPEN (code 14)` → **198 arquivos de teste vermelhos de uma vez, 1.474 testes,
// com cara de 198 defeitos de negócio**. Em produção (postgresql://) a URI saía perfeita, e
// por isso o estrago vivia SÓ no dev — a mesma classe do `contains` case-sensitive (28/08):
// funciona num banco e falha calado no outro.
//
// ⭐ Cada bloco aqui carrega o CONTRAFACTUAL da régua cega, porque sem ele o arquivo seria
// só uma afirmação sobre o mundo bom: ele passaria verde com a cura E com o defeito.

import { describe, it, expect } from 'vitest'
import { comTetoDeConexoes, PROTOCOLOS_COM_POOL } from '../teto-de-conexoes'

/** A régua CEGA — a que destruiu o dev. Mora aqui só pra ser o contrafactual. */
function reguaCega(url: string, limite: number): string {
  const u = new URL(url)
  u.searchParams.set('connection_limit', String(limite))
  return u.toString()
}

const TETO = 5

describe('o SQLite do dev passa INTOCADO', () => {
  // ⚠️ As três formas que o `.env` da casa já usou — e a do `schema.prisma`.
  it.each(['file:./dev.db', 'file:dev.db', 'file:prisma/dev.db', 'file:../dev.db'])(
    'não toca %s',
    (uri) => {
      expect(comTetoDeConexoes(uri, TETO)).toBe(uri)
    },
  )

  it('⛔ CONTRAFACTUAL: a régua cega resolve o relativo contra a RAIZ e quebra o engine', () => {
    // É o defeito exato, com os valores MEDIDOS: o caminho relativo vira absoluto e o
    // arquivo deixa de existir → o engine tenta abrir `/dev.db` → SQLITE_CANTOPEN (code 14).
    expect(reguaCega('file:./dev.db', TETO)).toBe('file:///dev.db?connection_limit=5')
    expect(reguaCega('file:prisma/dev.db', TETO)).toBe('file:///prisma/dev.db?connection_limit=5')

    // ⚠️ E TRÊS formas distintas colapsam no MESMO caminho — a régua cega não só move o
    // arquivo, ela apaga a diferença entre bancos que o dev escreveu de propósito.
    // (O `..` é ABSORVIDO: não dá pra subir além da raiz.)
    const colapsam = ['file:./dev.db', 'file:dev.db', 'file:../dev.db'].map((u) =>
      reguaCega(u, TETO),
    )
    expect(new Set(colapsam).size).toBe(1)
    expect(colapsam[0]).toBe('file:///dev.db?connection_limit=5')
  })

  it('o SQLite não tem pool nenhum — `connection_limit` ali nunca teve o que limitar', () => {
    const saida = comTetoDeConexoes('file:./dev.db', TETO)
    expect(saida).not.toContain('connection_limit')
  })
})

describe('o Postgres de prod ganha o teto e NADA MAIS', () => {
  it('acrescenta connection_limit preservando host, porta, caminho e query', () => {
    const saida = comTetoDeConexoes(
      'postgresql://user:senha@localhost:5432/conta_ia_prod?schema=public',
      TETO,
    )!
    const u = new URL(saida)
    expect(u.protocol).toBe('postgresql:')
    expect(u.host).toBe('localhost:5432')
    expect(u.pathname).toBe('/conta_ia_prod')
    expect(u.searchParams.get('schema')).toBe('public') // ⚠️ o ?schema não pode se perder
    expect(u.searchParams.get('connection_limit')).toBe('5')
  })

  it('o round-trip é LOSSLESS: só o parâmetro novo entra', () => {
    const antes = 'postgresql://user:senha@localhost:5432/conta_ia_prod?schema=public'
    const depois = comTetoDeConexoes(antes, TETO)!
    expect(depois).toBe(`${antes}&connection_limit=5`)
  })

  it('mysql também tem pool e também recebe', () => {
    const saida = comTetoDeConexoes('mysql://u:p@h:3306/d', TETO)!
    expect(new URL(saida).searchParams.get('connection_limit')).toBe('5')
  })

  it('respeita um valor JÁ declarado na própria URI — quem escreveu explicitamente manda', () => {
    const uri = 'postgresql://u:p@h:5432/d?connection_limit=20'
    expect(comTetoDeConexoes(uri, TETO)).toBe(uri)
  })
})

describe('ALLOWLIST, nunca denylist', () => {
  it('a lista é a dos bancos que TÊM pool', () => {
    expect([...PROTOCOLOS_COM_POOL].sort()).toEqual(['mysql:', 'postgres:', 'postgresql:'])
  })

  // ⛔ Protocolo novo/desconhecido cai no lado que NÃO MEXE. O erro seguro é um teto de pool
  // não declarado; o inseguro é a URI do banco reescrita por quem não entende o protocolo.
  it.each([
    'mongodb+srv://u:p@cluster.x.net/d',
    'sqlserver://host:1433;database=d',
    'prisma://aws.prisma-data.com/?api_key=xxx',
  ])('protocolo fora da lista passa intocado: %s', (uri) => {
    expect(comTetoDeConexoes(uri, TETO)).toBe(uri)
  })
})

// ⚠️⚠️ ESTE BLOCO NÃO PROVA A TRAVA DO ENDEREÇO — ela é INALCANÇÁVEL hoje, medido pela
// REGRA 11: removendo as 2 linhas do cinto em `teto-de-conexoes.ts`, os 19 testes ficam
// VERDES. A allowlist já barra tudo que não é postgres/mysql, e nesses o round-trip do
// WHATWG preserva host e pathname por construção. O que o bloco afirma é o INVARIANTE
// (o endereço sobrevive), não que o `if` do cinto esteja mordendo.
describe('o endereço do banco sobrevive ao round-trip (invariante, não a trava)', () => {
  it('host e pathname sobrevivem ao round-trip no caminho que GANHA o teto', () => {
    const antes = 'postgresql://u:p@db.interno:6543/app_prod?schema=public&sslmode=require'
    const depois = comTetoDeConexoes(antes, TETO)!
    const a = new URL(antes)
    const d = new URL(depois)
    expect(d.host).toBe(a.host)
    expect(d.pathname).toBe(a.pathname)
    expect(d.searchParams.get('sslmode')).toBe('require')
  })
})

describe('fail-soft, e NUNCA vaza a senha', () => {
  it('URI ausente volta ausente', () => {
    expect(comTetoDeConexoes(undefined, TETO)).toBeUndefined()
  })

  it('string vazia volta vazia (nunca vira URI inventada)', () => {
    expect(comTetoDeConexoes('', TETO)).toBe('')
  })

  it('URI impossível de parsear devolve a ORIGINAL e NÃO LANÇA', () => {
    // ⚠️ Um teto de pool não declarado é infinitamente melhor que o app não subir.
    const torta = 'postgresql://isto não é uma URI :: senha=hunter2'
    expect(() => comTetoDeConexoes(torta, TETO)).not.toThrow()
    expect(comTetoDeConexoes(torta, TETO)).toBe(torta)
  })

  it('⛔ CONTRAFACTUAL: a régua cega LANÇA na URI torta — e a exceção do URL/Prisma vaza a URI COM A SENHA (cicatriz de 07/10)', () => {
    expect(() => reguaCega('postgresql://isto não é uma URI :: senha=hunter2', TETO)).toThrow()
  })
})
