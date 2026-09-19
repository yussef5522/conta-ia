// ⛔⛔⛔ A ORDEM QUE SUMIU — ANO 202 + TETO DE 200 (19/09/2026)
//
// **O dono:** *"criei uma produção de calabresa ralada e ELA SUMIU — não aparece em lugar
// nenhum."* E o painel avisava de uma ordem parada que ele não achava.
//
// **Eram o MESMO caso**, medido por id (`…4et405`):
// ```
// dataProducao  0202-09-18T15:06:28.000Z     ← ano 202
// listOrdens    orderBy dataProducao desc, take 200
// a empresa     238 ordens  →  ela é a 238ª de 238  →  cortada pelo teto
// medido:       1 ordem ABERTA no banco · 0 visíveis em qualquer tela · R$ 42,18 presos
// ```
//
// ⭐⭐ **Os `:06:28` identificaram a string de origem**: no ano 202 São Paulo usava LMT
// −03:06:28, e `new Date('0202-09-18T12:00:00')` (sem `Z`) cai no fuso local. Nenhuma outra
// ordem tem segundos — todas gravam `15:00:00` cravado.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDaOrdem, dataEhPlausivel, DataDaOrdemError } from '@/lib/stock/producao/data-da-ordem'
import { saidasDaOrdemParada, HORAS_PARA_AVISAR } from '@/lib/stock/producao/saidas-da-ordem-parada'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

describe('⛔⛔ a data do ano 202 não pode mais nascer', () => {
  it('⭐ a string REAL do caso é recusada, com a frase que ensina', () => {
    expect(() => dataDaOrdem('0202-09-18')).toThrow(DataDaOrdemError)
    try { dataDaOrdem('0202-09-18') } catch (e) {
      expect((e as Error).message).toContain('202')
      expect((e as Error).message, 'a recusa tem que dizer o efeito').toMatch(/some das listas|preso/)
    }
  })

  it('⛔ e o CONTRAFACTUAL: a régua velha gravava o ano 202 em silêncio', () => {
    // era `z.string().min(1)` + new Date(`${s}T12:00:00`) — nenhum dos dois reclamava
    const velho = new Date('0202-09-18T12:00:00Z')
    expect(velho.getUTCFullYear()).toBe(202)
    expect(dataEhPlausivel(velho), 'a régua nova reconhece o que já está gravado').toBe(false)
  })

  it('⭐ ano de 3 dígitos e formato torto também caem', () => {
    for (const t of ['202-09-18', '2026-9-18', '18/09/2026', '', '2026-09']) {
      expect(() => dataDaOrdem(t), `"${t}" deveria ser recusado`).toThrow(DataDaOrdemError)
    }
  })

  it('⭐ a data BOA passa, e em UTC — nunca no fuso do processo', () => {
    expect(dataDaOrdem('2026-09-18').toISOString()).toBe('2026-09-18T12:00:00.000Z')
    expect(dataEhPlausivel(new Date('2026-09-18T12:00:00Z'))).toBe(true)
  })

  it('⚠️ a janela é LARGA de propósito: barra grandeza, não opina sobre o calendário', () => {
    expect(() => dataDaOrdem('2021-01-05')).not.toThrow()  // produção antiga entra
    expect(() => dataDaOrdem('2099-12-31')).not.toThrow()
    expect(() => dataDaOrdem('20262-09-18')).toThrow()
  })

  it('⛔ a ROTA valida o formato — não voltou pro .min(1)', () => {
    const r = fonte('app/api/empresas/[id]/estoque/producao/ordens/route.ts')
    expect(r, 'o .min(1) de volta é a porta do ano 202').not.toMatch(/dataProducao: z\.string\(\)\.min\(1\)/)
    expect(usosDe(r, 'dataDaOrdem'), 'a rota voltou a montar a Date na mão').toBeGreaterThan(0)
    expect(r, 'sem o Z a data volta a depender do fuso do processo').not.toMatch(/T12:00:00`\)/)
  })
})

describe('⛔⛔ nenhuma ordem ABERTA pode ficar sem casa', () => {
  it('⭐ a lista busca as abertas SEM teto, e o teto vale só pras encerradas', () => {
    const o = fonte('lib/stock/producao/ordens.ts')
    expect(o).toMatch(/estado: \{ in: \[\.\.\.ESTADOS_ABERTOS\] \}/)
    expect(o).toMatch(/estado: \{ notIn: \[\.\.\.ESTADOS_ABERTOS\] \}[\s\S]{0,120}take: 200/)
    // ⛔ o take não pode estar na busca das abertas — foi ele que escondeu a calabresa
    const abertas = o.slice(o.indexOf('estado: { in: [...ESTADOS_ABERTOS] }'), o.indexOf('estado: { notIn:'))
    expect(abertas, 'teto na busca das abertas é o defeito de volta').not.toMatch(/take:/)
  })

  it('⭐ e ESTADOS_ABERTOS tem um dono só (o painel reexporta, não redefine)', () => {
    const p = fonte('lib/stock/producao/painel-producao.ts')
    expect(p, 'duas listas de "o que está aberto" divergem no primeiro estado novo')
      .not.toMatch(/export const ESTADOS_ABERTOS = \[/)
    expect(p).toMatch(/export \{ ESTADOS_ABERTOS \} from '\.\/data-da-ordem'/)
  })
})

describe('⭐⭐ aviso sem porta é beco — as três saídas', () => {
  const base = { estado: 'EM_PRODUCAO', valorPreso: 42.18, horasParada: 45, temEtapaEmAndamento: false, temPlanoDeContinuar: false, dataPlausivel: true }

  it('⭐ o caso real: 45h parada, R$ 42,18 presos → avisa com as 3 portas', () => {
    const v = saidasDaOrdemParada(base)
    expect(v.avisar).toBe(true)
    expect(v.motivo).toContain('42,18')
    expect(v.portas.map((p) => p.acao)).toEqual(['CONCLUIR', 'CANCELAR_E_DEVOLVER', 'CONTINUA_DEPOIS'])
    expect(v.portas[0].primaria).toBe(true)
    // ⚠️ cada porta DIZ o efeito — escolher no escuro é o que deixa o lote parado mais um dia
    for (const p of v.portas) expect(p.efeito.length, `a porta ${p.acao} não diz o efeito`).toBeGreaterThan(20)
  })

  it('⭐ a data torta entra no motivo — é ela que explica o sumiço', () => {
    expect(saidasDaOrdemParada({ ...base, dataPlausivel: false }).motivo).toContain('sumiu das listas')
    expect(saidasDaOrdemParada(base).motivo).not.toContain('sumiu das listas')
  })

  it('⛔ etapa EM ANDAMENTO não é ordem parada — alguém está com a mão na massa', () => {
    expect(saidasDaOrdemParada({ ...base, temEtapaEmAndamento: true }).avisar).toBe(false)
  })

  it('⛔ lote que DORME não avisa — massa que descansa é a receita, não atraso', () => {
    expect(saidasDaOrdemParada({ ...base, temPlanoDeContinuar: true }).avisar).toBe(false)
  })

  it('⛔ e antes de 24h também não (a mesma régua do P2)', () => {
    expect(HORAS_PARA_AVISAR).toBe(24)
    expect(saidasDaOrdemParada({ ...base, horasParada: 12 }).avisar).toBe(false)
  })

  it('⛔ ordem CONCLUÍDA ou CANCELADA nunca avisa', () => {
    expect(saidasDaOrdemParada({ ...base, estado: 'CONCLUIDA' }).avisar).toBe(false)
    expect(saidasDaOrdemParada({ ...base, estado: 'CANCELADA' }).avisar).toBe(false)
  })

  it('⭐ o estado vem do SERVIDOR — a tela não deduz (senão discorda do P2)', () => {
    const r = fonte('app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/route.ts')
    expect(usosDe(r, 'saidasDaOrdemParada')).toBeGreaterThan(0)
    expect(r, 'plano VENCIDO tem que voltar a avisar').toMatch(/diaPrevisto[\s\S]{0,80}getTime\(\) >= Date\.now\(\)/)
  })

  it('⭐ e a TELA desenha as três, com a 3ª gravando de verdade', () => {
    const t = fonte('app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx')
    expect(t).toMatch(/parada\?\.avisar/)
    expect(t).toMatch(/acao: 'continua-depois'/)
    expect(t, 'a 1ª porta aponta pra uma âncora que precisa existir').toMatch(/id="concluir"/)
    expect(t, 'o efeito de cada porta some e o dono escolhe no escuro').toMatch(/porta\.efeito/)
  })

  it('⭐ a 3ª porta reusa o plano de etapa — nenhuma 2ª resposta pra "em que dia?"', () => {
    const l = fonte('lib/stock/producao/saidas-da-ordem-parada.ts')
    expect(l).toMatch(/stockEtapaPlano\.upsert/)
    expect(l, 'marcar todas faria o tablet mostrar etapa futura como se fosse de hoje')
      .toMatch(/finalizadoEm: null[\s\S]{0,80}orderBy: \{ posicao: 'asc' \}/)
  })
})
