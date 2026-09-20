// ⛔⛔⛔ OS DOIS GESTOS QUE EFETIVAVAM PELA METADE (18/09/2026)
//
// **O dono, navegando em prod:**
//  1. *"marquei uma saída como Distribuição de Lucros e ela só gravou a categoria: NÃO
//     abriu a ponte que mandava a retirada pro meu perfil PF. **Não quero meia-ponte
//     gravada.**"*
//  2. *"clico «parcela de empréstimo» e o seletor abre SEM NENHUM empréstimo — e a empresa
//     TEM contratos ativos."*
//
// ⭐ **AS DUAS INVESTIGAÇÕES DERAM RESULTADO DIFERENTE DA HIPÓTESE:**
//
// **(1) A ponte NÃO foi guardada na faxina de 15/09.** `WithdrawalPanel` está VIVO (o
// `xero-row` e a tela do sócio usam); os 4 arquivos com selo `CAPACIDADE GUARDADA` são
// outros. O que houve foi mais silencioso: **a caixa nasceu sem o convite**, porque o
// "convite pós-categorização" morava no Pendentes — e o Pendentes morreu como TELA.
//
// **(2) O seletor de empréstimo NÃO era dado.** O log do nginx prova que o payload chegou
// no navegador dele: `GET /api/empresas/…/emprestimos → 200 · 8024 bytes`, 23:37:06. A
// causa era **CSS**: o cartão ≍ é `overflow-hidden` e o menu era `absolute` dentro dele —
// **o painel era recortado pela borda do cartão**. *Menu que abre fora da vista é
// indistinguível de menu vazio.*

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { conviteDaPonte, ehRetirada, tipoSugerido } from '@/lib/conciliacao/convite-da-ponte'
import { posicaoDoMenu } from '@/lib/conciliacao/posicao-do-menu'
import { VAZIO } from '@/lib/conciliacao/vazio-do-menu'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const TELA = 'components/conciliacao/caixa-de-entrada.tsx'
/** ⚠️ o chassi ≍ virou componente em 20/09 — o cartão (e o overflow) moram nele agora */
const CHASSI = 'components/conciliacao/chassi-do-cartao.tsx'
const MENU = 'components/conciliacao/menu-do-chip.tsx'

// ═══════════════════════════════════════════════════════════════════════════════
describe('⭐⭐ 1. RETIRADA OFERECE A PONTE — meia-ponte não se grava em silêncio', () => {
  const DISTRIB = { id: 'c1', name: 'Distribuição de Lucros', dreGroup: 'DISTRIBUICAO_LUCROS' }
  const DESPESA = { id: 'd1', name: 'Matéria-Prima - Alimentos', dreGroup: 'CUSTO_PRODUTO_VENDIDO' }

  it('⭐ categorizar como retirada devolve o convite do passo 2', () => {
    const c = conviteDaPonte(DISTRIB)
    expect(c).not.toBeNull()
    expect(c!.oferecer).toBe(true)
    expect(c!.titulo).toMatch(/perfil PF/i)
  })

  it('⛔ despesa comum NÃO oferece ponte — só retirada abre a porta pro PF', () => {
    expect(conviteDaPonte(DESPESA)).toBeNull()
    expect(conviteDaPonte(null)).toBeNull()
  })

  it('⛔⛔ quem decide é o dreGroup, NUNCA o nome', () => {
    // categoria com "lucro" no nome, mas de despesa administrativa
    expect(ehRetirada({ id: 'x', name: 'Seguro de lucros cessantes', dreGroup: 'DESPESAS_ADMINISTRATIVAS' })).toBe(false)
    // e a de retirada com nome que não diz "lucro" continua sendo retirada
    expect(ehRetirada({ id: 'y', name: 'INSS sobre Pró-labore', dreGroup: 'DISTRIBUICAO_LUCROS' })).toBe(true)
  })

  it('⭐ o convite DIZ onde o gesto continua existindo se o dono pular', () => {
    expect(conviteDaPonte(DISTRIB)!.ondeReabrir).toBe('/retiradas-pendentes')
  })

  it('⭐ o tipo é SUGESTÃO (o painel confirma) e o ambíguo não chuta', () => {
    expect(tipoSugerido({ id: 'a', name: 'Distribuição de Lucros', dreGroup: 'DISTRIBUICAO_LUCROS' })).toBe('DISTRIBUICAO')
    expect(tipoSugerido({ id: 'b', name: 'Pró-labore Sócios', dreGroup: 'DISTRIBUICAO_LUCROS' })).toBe('PRO_LABORE')
    // ⛔ "Pró-labore e Distribuição" diz as DUAS coisas → o dono escolhe
    expect(tipoSugerido({ id: 'c', name: 'Pró-labore e Distribuição', dreGroup: 'DISTRIBUICAO_LUCROS' })).toBeNull()
  })

  it('⭐ a TELA oferece o convite e reusa o painel que já existe (REGRA 4)', () => {
    const t = fonte(TELA)
    expect(t, 'a tela deixou de oferecer a ponte depois de gravar a retirada')
      .toMatch(/conviteDaPonte\(cat\)[\s\S]{0,120}setPonte/)
    expect(t, 'reescreveu a ponte em vez de usar o WithdrawalPanel').toMatch(/<WithdrawalPanel/)
  })

  /**
   * ⚠️ ASSERÇÃO ATUALIZADA EM 19/09 com o motivo: o destino do "pular" deixou de ser a
   * frase solta *"Retiradas pendentes"* e passou a nomear a TELA **Retiradas** — que no
   * mesmo commit ganhou entrada no menu e a seção das concluídas. O que o teste cobra
   * continua sendo o mesmo: *pular tem que dizer onde o gesto continua existindo*.
   */
  it('⛔ PULAR é legítimo — e a tela diz onde reabrir, senão pular vira perder', () => {
    expect(fonte(TELA)).toMatch(/fica em Retiradas/)
    expect(fonte(TELA)).toMatch(/ponte pendente em Retiradas/)
  })

  it('⭐ o selo do sucesso nomeia AS DUAS PONTAS', () => {
    expect(fonte(TELA)).toMatch(/entrada no perfil PF · pontas vinculadas/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('⛔⛔ 2. O MENU NÃO PODE SER RECORTADO PELO CARTÃO', () => {
  it('⭐ o painel vai pro PORTAL — o cartão ≍ é overflow-hidden e cortava tudo', () => {
    const m = fonte(MENU)
    expect(m, 'o menu voltou a ser absolute dentro do cartão — será recortado de novo')
      .toMatch(/createPortal\(/)
    expect(m, 'voltou o posicionamento absoluto relativo ao cartão').not.toMatch(/absolute left-0 top-\[calc/)
  })

  it('⛔ e o cartão CONTINUA com overflow-hidden (é o que arredonda os dois lados)', () => {
    // ⚠️ o guard prova que o conserto foi no MENU, não removendo o arredondamento do cartão
    expect(fonte(CHASSI), 'o cartão perdeu o overflow que arredonda os dois lados').toMatch(/overflow-hidden rounded-\[22px\]/)
  })

  it('⭐ abre pra BAIXO quando há espaço', () => {
    const p = posicaoDoMenu({ left: 40, top: 100, bottom: 130, width: 120 }, { largura: 400, altura: 800 })
    expect(p.lado).toBe('ABAIXO')
    expect(p.top).toBe(136)
    expect(p.maxAltura).toBeGreaterThan(600)
  })

  it('⭐ abre pra CIMA quando o chip está no rodapé — senão o menu nasce num vão de 40px', () => {
    const p = posicaoDoMenu({ left: 40, top: 700, bottom: 740, width: 120 }, { largura: 400, altura: 800 })
    expect(p.lado).toBe('ACIMA')
    expect(p.bottom).toBe(800 - 700 + 6)
  })

  it('⛔ nunca sangra pela direita (o chip fica perto da borda no celular)', () => {
    const p = posicaoDoMenu({ left: 380, top: 100, bottom: 130, width: 60 }, { largura: 400, altura: 800 })
    expect(p.left + p.largura).toBeLessThanOrEqual(400 - 12)
    expect(p.left).toBeGreaterThanOrEqual(12)
  })

  it('⭐ a altura é o espaço REAL que sobra — foi altura fixa que produziu o menu "vazio"', () => {
    const apertado = posicaoDoMenu({ left: 10, top: 300, bottom: 330, width: 100 }, { largura: 400, altura: 420 })
    expect(apertado.maxAltura).toBeLessThan(300)
    expect(apertado.maxAltura).toBeGreaterThanOrEqual(160)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('⛔⛔ o vazio NÃO afirma o que não sabe', () => {
  it('⭐ FALHOU diz que não conseguiu carregar — nunca "não existe"', () => {
    const f = VAZIO.contratos('FALHOU')
    expect(f.texto).toMatch(/Não consegui carregar/)
    expect(f.texto, 'afirmou sobre a empresa a partir de uma falha de rede').not.toMatch(/Nenhum contrato/)
    expect(f.tom).toBe('ALERTA')
  })

  it('⭐ OK + vazio é a ÚNICA situação que fala da empresa', () => {
    expect(VAZIO.contratos('OK').texto).toMatch(/Nenhum contrato com parcela em aberto nesta empresa/)
    expect(VAZIO.categorias('OK').texto).toMatch(/Nenhuma categoria ativa nesta empresa/)
    expect(VAZIO.cartoes('OK').texto).toMatch(/Nenhum cartão cadastrado nesta empresa/)
  })

  it('⭐ CARREGANDO não é vazio nem erro', () => {
    expect(VAZIO.contratos('CARREGANDO').texto).toMatch(/carregando/i)
  })

  it('⭐ e a TELA consome os três estados (não escreve a frase à mão)', () => {
    const t = fonte(TELA)
    expect(t).toMatch(/VAZIO\.contratos\(cargas\.contratos\)/)
    expect(t).toMatch(/VAZIO\.categorias\(cargas\.categorias\)/)
    expect(t).toMatch(/VAZIO\.cartoes\(cargas\.cartoes\)/)
    expect(t, 'a tela deixou de registrar se a carga falhou').toMatch(/setCargas\(\{/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('⭐ DONO ÚNICO — seletor e painel de empréstimos leem a MESMA fonte', () => {
  it('⭐ a caixa lê a rota da carteira, não uma consulta própria', () => {
    expect(fonte(TELA)).toMatch(/\/api\/empresas\/\$\{empresaId\}\/emprestimos/)
  })

  it('⛔ e a tela de Empréstimos lê a mesma — se divergirem, uma lista contrato que a outra não', () => {
    const carteira = fonte('app/(dashboard)/empresas/[id]/emprestimos/page.tsx')
    expect(carteira).toMatch(/\/api\/empresas\/\$\{[a-zA-Z]+\}\/emprestimos/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('⛔⛔ NADA QUE SOME SOZINHO CARREGA DECISÃO (19/09)', () => {
  /**
   * **O dono:** *"clico «Distribuição de Lucros» e aparece uma mensagem em cima que
   * DESAPARECE sozinha — não abre a tela de escolher na hora, e depois eu não sei ONDE
   * achar as retiradas. Fiz 2 que teriam ido pra PF e não sei se deram certo."*
   *
   * ⭐ O convite deixou de ser faixa no topo: ele abre **ancorado na linha**, como o Find &
   * Match — e a linha **fica na caixa** até ele responder (mandar ou pular, explícito).
   */
  const t = () => fonte(TELA)

  it('⭐ o painel da ponte abre NA LINHA que ele categorizou', () => {
    expect(t(), 'o convite voltou a ser uma faixa solta no topo')
      .toMatch(/ponte\?\.linha\.id === l\.id/)
  })

  it('⛔⛔ e a linha NÃO sai da caixa antes de ele responder', () => {
    // no ramo da retirada o gesto retorna ANTES do carregar()
    expect(t(), 'voltou a recarregar na hora — a linha some e o convite fica órfão')
      .toMatch(/if \(convite\) \{ setPonte\(\{ linha, convite \}\); return \}/)
  })

  it('⭐ pular é explícito e diz onde o gesto continua', () => {
    expect(t()).toMatch(/pular — fica em Retiradas/)
    expect(t()).toMatch(/ponte pendente em Retiradas/)
  })
})

describe('⭐⭐ RETIRADAS tem UM LUGAR VISÍVEL (19/09)', () => {
  it('⛔ a tela existia desde 08/08 e NÃO estava no menu — a maçaneta que faltava', () => {
    const menu = fonte('components/sidebar/global-sidebar.tsx')
    expect(menu, 'o item Retiradas sumiu do menu — a tela volta a ser inalcançável')
      .toMatch(/label="Retiradas"/)
    expect(menu).toMatch(/\/empresas\/\$\{empresaAtiva\}\/retiradas/)
  })

  it('⭐ e a tela mostra as CONCLUÍDAS, não só as pendentes', () => {
    const pag = fonte('app/(dashboard)/empresas/[id]/retiradas/page.tsx')
    expect(pag, 'a seção das concluídas sumiu — "deu certo?" fica sem resposta')
      .toMatch(/<RetiradasConcluidas/)
  })

  it('⭐ cada concluída linka pra ponte, que mostra AS DUAS pontas', () => {
    const c = fonte('components/withdrawals/RetiradasConcluidas.tsx')
    expect(c).toMatch(/\/pontes\/\$\{p\.id\}/)
    expect(c).toMatch(/conferir as 2 pontas/)
  })

  it('⛔ e ali erro NÃO vira "nenhuma ponte"', () => {
    const c = fonte('components/withdrawals/RetiradasConcluidas.tsx')
    expect(c).toMatch(/não<\/b> quer dizer que não existam/)
  })
})
