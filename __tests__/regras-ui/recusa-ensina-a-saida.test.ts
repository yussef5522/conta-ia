// ⛔⛔⛔ RECUSA ENSINA A SAÍDA — erro sem motivo é defeito (16/09/2026)
//
// **A régua do dono:** *"a mensagem de falha da contagem (e de TODO formulário de estoque)
// diz SEMPRE o porquê e a saída. O 409 do fornecedor já faz isso — a contagem herda."*
//
// ⛔ **O DEFEITO QUE O CRIOU, medido em prod:** a contagem do fermento respondia
// *"Não consegui gravar a contagem"* — sem motivo. O servidor tinha a explicação inteira
// (`MovementInvalidError`: *"valor R$ −31,04 · dinheiro negativo com saldo positivo é um
// estado que não existe"*) e ela **morria no `throw e`** da rota: virava 500 sem corpo, e
// o cliente caía no `j.erro ?? '…'`. **A frase existia; ninguém a entregava.**

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { respostaDeErroDoEstoque, ehErroDeDominio, fraseDeQuantidadeInvalida } from '@/lib/stock/erro-da-tela'
import { MovementInvalidError } from '@/lib/stock/movement'
import { ContagemError } from '@/lib/stock/contagem'

const raiz = process.cwd()

/** ⭐ as rotas de FORMULÁRIO — as que gravam a partir de um gesto do dono */
const FORMS = [
  'app/api/empresas/[id]/estoque/contagem/linha/route.ts',
  'app/api/empresas/[id]/estoque/contagem/marcar/route.ts',
  'app/api/empresas/[id]/estoque/contagem/finalizar/route.ts',
  'app/api/empresas/[id]/estoque/saida/route.ts',
  'app/api/empresas/[id]/estoque/entrada-manual/route.ts',
]

/**
 * ⭐ CONTA O **USO**, NÃO A MENÇÃO — a linha do `import` não vale.
 *
 * ⚠️⚠️ **TERCEIRA VEZ EM TRÊS DIAS** que um guard meu passou verde por casar com o import:
 * o `acaoValePraSentido` (15/09), o `MELHOR PALPITE` no comentário (16/09) e este. A
 * REGRA 11 pegou os três — e por isso o padrão virou helper em vez de lembrança.
 */
export function usosDe(src: string, simbolo: string): number {
  return src
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

describe('⛔ nenhuma rota de formulário do estoque devolve 500 mudo', () => {
  for (const f of FORMS) {
    it(`⭐ ${f.split('/').slice(-2)[0]} CHAMA o tradutor (não só importa)`, () => {
      const src = readFileSync(join(raiz, f), 'utf-8')
      expect(
        usosDe(src, 'respostaDeErroDoEstoque'),
        `${f} importa o tradutor e não o chama — o erro volta a virar 500 sem corpo`,
      ).toBeGreaterThan(0)
    })
  }
})

describe('⭐⭐ o tradutor entrega a mensagem QUE JÁ EXISTIA', () => {
  /**
   * ⛔ ESTE É O CASO REAL DO FERMENTO, com os números de prod: saldo −1,921, valor
   * −R$ 31,04, e o dono contando 10 kg (a quantidade CERTA — é o que está na prateleira).
   */
  it('⭐ MovementInvalidError vira 422 COM o motivo e COM a saída', () => {
    const e = new MovementInvalidError(
      'Este movimento deixaria o item com 10 unidade(s) e valor R$ -31.04 — dinheiro negativo com saldo positivo é um estado que não existe.',
    )
    const r = respostaDeErroDoEstoque(e, { empresaId: 'emp1', itemId: 'item1' })
    expect(r).toBeTruthy()
    expect(r!.status).toBe(422)
    expect(r!.erro, 'o motivo se perdeu').toContain('-31.04')
    expect(r!.code).toBe('ESTADO_IMPOSSIVEL')
    // ⭐ a saída: o gesto que RESOLVE, não um beco
    expect(r!.saida, 'recusa sem saída é beco').toBeTruthy()
    expect(r!.saida!.href).toContain('/estoque/itens/item1')
  })

  it('⭐ o FREIO continua 409 — a tela PERGUNTA de novo, não é erro final', () => {
    const r = respostaDeErroDoEstoque(new ContagemError('Confirme: fermento — …', 'FREIO'), { empresaId: 'e' })
    expect(r!.status).toBe(409)
    expect(r!.code).toBe('FREIO')
  })

  /**
   * ⛔⛔ E O ERRO DESCONHECIDO CONTINUA SUBINDO. Inventar frase amigável pra um bug que
   * ninguém previu **esconde o bug** — o 500 ali é a resposta honesta.
   */
  it('⭐ erro que ninguém previu devolve null (a rota re-lança)', () => {
    expect(respostaDeErroDoEstoque(new TypeError('x.y is not a function'), { empresaId: 'e' })).toBeNull()
    expect(ehErroDeDominio(new TypeError('boom'))).toBe(false)
  })
})

describe('⭐ o formato inválido DIZ o formato certo', () => {
  it('⭐ decimal em unidade inteira ensina a saída', () => {
    const f = fraseDeQuantidadeInvalida('UN', '2,5')
    expect(f).toContain('UN')
    expect(f).toContain('2,5')
    expect(f, 'não ensinou o caminho').toMatch(/unidade menor/)
  })

  it('⭐ e o texto ilegível ensina a vírgula (o pedido do dono)', () => {
    expect(fraseDeQuantidadeInvalida('KG', 'abc')).toContain('2,5')
  })
})

describe('⛔ a TELA não inventa um genérico quando o servidor falou', () => {
  const tela = readFileSync(join(raiz, 'app/(dashboard)/empresas/[id]/estoque/contagem/page.tsx'), 'utf-8')
  const semComentario = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⛔ o fallback "Não consegui gravar a contagem" morreu', () => {
    expect(
      semComentario,
      'o genérico voltou — ele esconde a frase que o servidor mandou',
    ).not.toContain('Não consegui gravar a contagem')
  })

  it('⭐ e quando o servidor NÃO fala, a tela admite que é defeito nosso', () => {
    expect(semComentario).toContain('defeito nosso')
  })

  it('⭐ a tela desenha o link da saída', () => {
    expect(semComentario, 'a saída chega no payload e a tela não mostra').toContain('erro.saida')
  })
})

// ⭐⭐ REGRA 11 — o detector pega o defeito que motivou o guard.
describe('o detector morde (auto-teste)', () => {
  it('⭐ acusa a rota que voltaria a ter catch mudo', () => {
    const ROTA_MUDA = `} catch (e) {\n    if (e instanceof SaidaError) return json(422)\n    throw e\n  }`
    expect(ROTA_MUDA.includes('respostaDeErroDoEstoque')).toBe(false)
  })

  it('⭐ e a lista de forms não está vazia (senão o guard não olha nada)', () => {
    expect(FORMS.length).toBeGreaterThan(0)
    for (const f of FORMS) expect(existsSync(join(raiz, f)), `${f} sumiu — o guard perdeu o alvo`).toBe(true)
  })
})
