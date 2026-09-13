// ⛔⛔⛔ EXISTIR POR ROTA É NÃO EXISTIR — 5ª VOLTA DA FAMÍLIA (13/09/2026)
//
// **O dono:** *"o import de extrato existe (você provou pela rota: 3 casadas, 2 novas,
// aprender-na-conta) mas NÃO TEM BOTÃO NA TELA. Estou em /perfis/[id] → Contas bancárias:
// os 3 cards e 'Nova conta' — nenhum 'importar extrato' em card nenhum."*
//
// **Ele estava certo, e o card era pior que eu pensava: um `<Card>` MORTO** — sem botão,
// sem link, sem toque. O motor estava em prod, provado, **inalcançável**.
//
// ⭐ **A FAMÍLIA INTEIRA, em ordem:** (1) 10/09 o card da conciliação nascia colapsado;
// (2) 10/09 o motor subiu e a tela não mudou; (3) 12/09 a porta do cardápio sumia quando a
// fila zerava; (4) 12/09 o produto individual nunca teve o gesto; **(5) hoje: o gesto só
// existia por rota.** A regra que fecha as cinco: **se o motor está em prod, o dedo do dono
// tem que alcançar ele a partir de onde ele ESTÁ** — e onde ele está é a lista de contas.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ comentário não é tela — sem isto o guard morderia a própria lápide do defeito */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const CONTAS = 'app/(dashboard)/perfis/[id]/contas/page.tsx'
const EXTRATO = 'app/(dashboard)/perfis/[id]/extrato/page.tsx'
const MES = 'app/(dashboard)/perfis/[id]/mes/page.tsx'
const SIDEBAR = 'components/sidebar/global-sidebar.tsx'

describe('⛔⛔ o gesto de importar extrato PF é ALCANÇÁVEL', () => {
  const contas = semComentarios(ler(CONTAS))

  it('⭐ o CARD da conta leva pro import — era um <Card> morto', () => {
    expect(contas, '⛔ o card voltou a ser morto: nenhum link pro extrato').toMatch(/\/extrato\?conta=/)
    expect(contas).toContain('Importar extrato')
  })

  it('⭐ e o card carrega a conta escolhida — não joga o dono numa lista pra escolher de novo', () => {
    // perder no caminho a informação que a tela acabou de mostrar é obrigar a repetir
    // (a lição do deep-link da conciliação, 10/09)
    expect(contas).toMatch(/extrato\?conta=\$\{a\.id\}/)
  })

  it('⭐ a CONFERÊNCIA aparece no card da conta — a casa dela (10/09)', () => {
    expect(contas).toContain('ledgerBal')
    expect(contas).toContain('nunca conferida')
  })

  it('⛔ a tela do extrato ACEITA `?conta=` — senão o link do card seria decorativo', () => {
    const ex = semComentarios(ler(EXTRATO))
    expect(ex).toContain("sp.get('conta')")
    // ⚠️ e não pode sobrescrever a escolha que veio do card
    expect(ex).toMatch(/atual \|\| /)
  })

  it('⭐ o menu do PF leva às duas telas novas', () => {
    const sb = semComentarios(ler(SIDEBAR))
    expect(sb).toMatch(/perfis\/\$\{currentProfileId\}\/mes/)
    expect(sb).toMatch(/perfis\/\$\{currentProfileId\}\/extrato/)
  })
})

describe('⛔ nenhuma das telas novas nasce escondida', () => {
  // o guard irmão de 10/09: componente que o dono precisa VER não pode estar atrás de um
  // booleano que começa `false`
  it.each([[CONTAS], [EXTRATO], [MES]])('%s não esconde o conteúdo atrás de um estado inicial falso', (arquivo) => {
    const src = semComentarios(ler(arquivo))
    // procura `useState(false)` cujo nome sugira visibilidade do conteúdo principal
    const suspeitos = [...src.matchAll(/const \[(mostrar|ver|aberto|expandido|visivel)\w*, set\w+\] = useState\(false\)/gi)]
    expect(suspeitos.map((m) => m[0]), 'conteúdo principal atrás de um booleano que nasce false').toEqual([])
  })
})

describe('⭐ e o motor por trás do gesto existe de verdade', () => {
  // ⚠️ um guard que só olhasse a TELA aprovaria um botão que aponta pro nada — foi assim
  // que o "porta sem maçaneta" nasceu ao contrário em 10/09 (a tela sem o motor).
  it.each([
    ['app/api/perfis/[id]/extrato-conta/preview/route.ts'],
    ['app/api/perfis/[id]/extrato-conta/confirm/route.ts'],
    ['app/api/perfis/[id]/painel-do-mes/route.ts'],
  ])('a rota %s existe', (r) => {
    expect(existsSync(join(raiz, r)), `${r} sumiu — o botão apontaria pro nada`).toBe(true)
  })

  it('⛔ e as três exigem o dono do perfil', () => {
    for (const r of [
      'app/api/perfis/[id]/extrato-conta/preview/route.ts',
      'app/api/perfis/[id]/extrato-conta/confirm/route.ts',
      'app/api/perfis/[id]/painel-do-mes/route.ts',
    ]) {
      expect(semComentarios(ler(r)), `${r} não checa o acesso ao perfil`).toContain('checkProfileAccess')
    }
  })
})
