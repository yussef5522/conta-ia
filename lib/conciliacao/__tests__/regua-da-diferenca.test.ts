// ⛔⛔⛔ O SERVIDOR RECUSAVA O QUE A TELA OFERECIA (12/09/2026)
//
// **O dono, conciliando a OESA:** linha **1.695,27** × NF 3866696 de **1.641,12**, os
// **54,15** de multa+juros (3,3% da linha — dentro do gesto explícito de ontem). A tela
// acendeu o Conciliar e o servidor respondeu:
//
// > *"Soma 1 candidate(s) (R$ 1641.12) não bate com OFX (R$ 1695.27). Diferença: R$ 54.15.
// > **Tolerância máxima: R$ 0.02**."*
//
// ⚠️⚠️ **E A CAUSA NÃO ERA A RÉGUA DE 0,02** — ela media a coisa certa. O card **coletava o
// nome da diferença e nunca o enviava**: o POST ia só com `candidateIds`, e o servidor não
// tinha como saber que havia algo confirmado.

import { describe, it, expect } from 'vitest'
import {
  avaliarDiferenca, servidorAceitaADiferenca, tetoDoGestoManual,
  FECHA_AO_CENTAVO, TETO_QUE_O_SISTEMA_OFERECE,
} from '../regua-da-diferenca'

/** o caso real, com os números dele */
const OESA = { linha: 1695.27, nota: 1641.12 }
const difDaOesa = Math.round((OESA.linha - OESA.nota) * 100) / 100   // 54,15

describe('⭐⭐ os três degraus, num dono só', () => {
  it('⭐ FECHA — dentro do arredondamento bancário', () => {
    expect(avaliarDiferenca(1000, 0.02).degrau).toBe('FECHA')
    expect(avaliarDiferenca(1000, 0.02).podeFechar).toBe(true)   // ⭐ nem pergunta
  })

  it('⭐ OFERECE — até R$ 25 o sistema propõe o acerto nomeado', () => {
    const v = avaliarDiferenca(1000, 20)
    expect(v.degrau).toBe('OFERECE')
    expect(v.podeFechar).toBe(false)                              // ⛔ mas só com o nome
    expect(avaliarDiferenca(1000, 20, true).podeFechar).toBe(true)
  })

  it('⭐⭐ PERGUNTA — a OESA: 54,15 acima dos 25 e dentro de 10% da linha', () => {
    const v = avaliarDiferenca(OESA.linha, difDaOesa)
    expect(difDaOesa).toBeCloseTo(54.15, 2)
    expect(difDaOesa).toBeGreaterThan(TETO_QUE_O_SISTEMA_OFERECE)
    expect(v.degrau).toBe('PERGUNTA')
    expect(v.frase).toContain('54,15')
    expect(v.frase).toContain('juros/multa de atraso')
    expect(v.tetoDoGesto).toBeCloseTo(169.53, 2)
  })

  it('⛔ RECUSA — acima de 10% não há gesto nenhum', () => {
    const v = avaliarDiferenca(600, 500, true)
    expect(v.degrau).toBe('RECUSA')
    expect(v.podeFechar).toBe(false)                              // ⛔ nem nomeando
  })

  it('⚠️ o DEGRAU não muda quando o dono marca a caixinha — só o podeFechar', () => {
    // senão a tela mudaria de degrau no clique e o servidor avaliaria outro
    expect(avaliarDiferenca(OESA.linha, difDaOesa).degrau)
      .toBe(avaliarDiferenca(OESA.linha, difDaOesa, true).degrau)
  })
})

describe('⛔⛔ o SERVIDOR aceita exatamente o que a tela oferece', () => {
  const daOesa = (diferencaConfirmada?: number) => servidorAceitaADiferenca({
    valorDaLinha: OESA.linha, somaMarcada: OESA.nota, diferencaConfirmada,
  })

  it('⛔⛔ SEM o dono nomear, recusa — e a mensagem diz O QUE FAZER', () => {
    const r = daOesa()
    expect(r.ok).toBe(false)
    expect((r as { erro: string }).erro).toContain('confirme na tela')
    // ⚠️ "Tolerância máxima: R$ 0,02" mandava procurar um erro que não existia
    expect((r as { erro: string }).erro).not.toContain('Tolerância')
  })

  it('⭐⭐ COM os 54,15 nomeados, ACEITA — é o caso da OESA fechando', () => {
    const r = daOesa(difDaOesa)
    expect(r.ok).toBe(true)
    expect((r as { veredicto: { degrau: string } }).veredicto.degrau).toBe('PERGUNTA')
  })

  it('⛔ mas um número QUE NÃO BATE é recusado — não é force disfarçado', () => {
    const r = daOesa(999)
    expect(r.ok).toBe(false)
    expect((r as { erro: string }).erro).toContain('não bate com a real')
  })

  it('⭐ a soma que fecha ao centavo passa sem nome nenhum', () => {
    expect(servidorAceitaADiferenca({ valorDaLinha: 1000, somaMarcada: 999.99 }).ok).toBe(true)
  })

  it('⛔⛔ e acima de 10% o servidor recusa MESMO nomeado', () => {
    const r = servidorAceitaADiferenca({ valorDaLinha: 1100, somaMarcada: 600, diferencaConfirmada: 500 })
    expect(r.ok).toBe(false)
    expect((r as { erro: string }).erro).toContain('teto de segurança')
  })

  it('⭐⭐⭐ TELA E SERVIDOR NUNCA DISCORDAM — varredura de 0 a 20% da linha', () => {
    const linha = 1695.27
    for (let d = 0; d <= linha * 0.2; d += 3.77) {
      const dif = Math.round(d * 100) / 100
      const tela = avaliarDiferenca(linha, dif, true)          // o dono nomeou
      const servidor = servidorAceitaADiferenca({ valorDaLinha: linha, somaMarcada: linha - dif, diferencaConfirmada: dif })
      expect(servidor.ok, `diferença ${dif}: tela=${tela.podeFechar} servidor=${servidor.ok}`).toBe(tela.podeFechar)
    }
  })

  it('⭐ os IRMÃOS da mesma fila fecham pelo mesmo gesto', () => {
    // Focatto 68,55 · Cia da Fruta 32,35 · Box 63,78 · Ivan 69,50
    for (const [nome, linha, dif] of [
      ['Focatto', 2528.31, 68.55], ['Cia da Fruta', 1263.13, 32.35],
      ['Box Paper', 5211.85, 63.78], ['Ivan', 2008.00, 69.50],
    ] as [string, number, number][]) {
      const v = avaliarDiferenca(linha, dif)
      expect(v.degrau, `${nome} caiu em ${v.degrau}`).toBe('PERGUNTA')
      expect(servidorAceitaADiferenca({ valorDaLinha: linha, somaMarcada: linha - dif, diferencaConfirmada: dif }).ok).toBe(true)
    }
  })
})

// ⛔⛔ O RASTRO SÓ EXISTIA NUM DOS DOIS RAMOS (12/09/2026)
//
// A OESA fechou com os 54,15 aceitos e o `notes` ficou **sem uma linha explicando**: o texto
// do rastro vivia só no ramo `EFFECTED_ORPHAN` (o caso do Cancian, uma ex-payable já paga).
// A conta em aberto normal segue o ramo **CLASSIC**, e por ali não passava nada.
//
// ⚠️ Guard ESTRUTURAL e assumido como tal: o `reconcileTransactions` precisa de banco e de
// sessão pra rodar inteiro. O que quebrou de fato foi o texto existir num ramo só — e é isso
// que ele trava, com auto-teste do detector.

import { readFileSync } from 'fs'
import { join } from 'path'

describe('⛔⛔ o rastro da diferença vale pros DOIS ramos', () => {
  const fonte = readFileSync(join(__dirname, '..', 'reconcile.ts'), 'utf8')
  /**
   * ⚠️⚠️ A REGRA 11 REPROVOU O MEU PRIMEIRO DETECTOR: ele pegava uma janela de 3.500
   * caracteres em volta do `mode:` — e essa janela alcançava a DECLARAÇÃO do rastro, que
   * fica acima dos dois ramos. Removi o uso no CLASSIC e os 17 testes ficaram VERDES.
   * ⭐ O que morde é contar o **USO** (a escrita em `notes`), não a vizinhança do texto.
   */
  const escritasDoRastro = (fonte.match(/notes: \[candidate\.notes, rastroDaDiferenca\]/g) ?? []).length
  const ramo = (modo: string) => {
    const i = fonte.indexOf(`mode: '${modo}'`)
    expect(i, `ramo ${modo} sumiu`).toBeGreaterThan(-1)
    return fonte.slice(Math.max(0, i - 3000), i + 500)
  }

  it('⭐ o texto é montado UMA vez — não há segunda cópia pra divergir', () => {
    const montagens = fonte.split('= juros/tarifa de boleto, confirmada por quem conciliou').length - 1
    expect(montagens).toBe(1)
  })

  it('⛔⛔ os DOIS ramos ESCREVEM o rastro — um só era o defeito da OESA', () => {
    // ⭐ dois usos: um no CLASSIC (conta em aberto) e um no EFFECTED_ORPHAN (ex-payable)
    expect(escritasDoRastro).toBe(2)
  })

  it('⭐ e os DOIS gravam a diferença no metadata do audit', () => {
    expect(ramo('CLASSIC')).toContain('diferencaAceita')
    expect(ramo('EFFECTED_ORPHAN')).toContain('diferencaAceita')
  })

  it('⚠️ AUTO-TESTE: o detector reprova um ramo sem o rastro', () => {
    const falso = "metadata: { mode: 'FALSO', ofxTransactionId: x }"
    expect(falso).not.toContain('rastroDaDiferenca')
  })
})
