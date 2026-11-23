// ⭐⭐⭐ A LEI DO LEITOR DE FATURA (23/11/2026) — vale pra TODO banco, presente e futuro.
//
// O dono: "leitor multi-banco com prova interna e falha honesta — é produto pra vender".
// Uma fatura só ENTRA quando o parser entrega as DUAS provas, e as duas passam:
//   CARTAO — a soma das linhas de cada cartão bate o total que o PDF declara pra ele (quando o
//            banco só declara um total pra todos os portadores, é contra esse total);
//   FATURA — a fatura inteira fecha com o total a pagar que o PDF declara.
// Não bateu → RECUSA com frase honesta e NADA é importado: meia-fatura não existe.
//
// ⚠️ PORTA ÚNICA: o orquestrador (`extract-invoice-smart`) aplica a lei DEPOIS do validador do
// banco. Um parser novo que esquecer de marcar suas provas é RECUSADO aqui — a disciplina que
// dependia de lembrar vira impossibilidade (REGRA 5).
import type { FaturaValidation, MotivoDaRecusa } from './validate-fatura'

export function aplicarLeiDoLeitor(v: FaturaValidation, banco: string): FaturaValidation {
  if (!v.ok) return { ...v, motivo: v.motivo ?? 'CONTA_NAO_FECHOU' }
  const temCartao = v.checks.some((c) => c.lei === 'CARTAO')
  const temFatura = v.checks.some((c) => c.lei === 'FATURA')
  const falhou = v.checks.filter((c) => !c.pass)
  if (falhou.length > 0) {
    return { ok: false, checks: v.checks, motivo: 'CONTA_NAO_FECHOU', message: v.message ?? `A conta da fatura do ${banco} não fechou — nada foi importado.` }
  }
  if (!temCartao || !temFatura) {
    const falta = !temCartao && !temFatura ? 'nem a soma por cartão nem o total da fatura' : !temCartao ? 'a soma por cartão' : 'o total da fatura'
    return {
      ok: false, checks: v.checks, motivo: 'LAYOUT_DIFERENTE',
      message: `Não consegui conferir esta fatura do ${banco}: faltou provar ${falta} contra o que o PDF declara. Sem as duas provas, nada é importado.`,
    }
  }
  return v
}

/** o título da recusa, nas palavras do dono (a tela abre com ele) */
export const TITULO_DA_RECUSA: Record<MotivoDaRecusa, string> = {
  BANCO_NAO_SUPORTADO: 'Não consegui ler esta fatura — banco não suportado',
  LAYOUT_DIFERENTE: 'Não consegui ler esta fatura — o layout é diferente do que eu conheço',
  CONTA_NAO_FECHOU: 'Não consegui ler esta fatura — a conta não fechou',
}

/**
 * ⭐ os bancos que o leitor LÊ COM PROVA, numa constante PURA que a TELA pode importar (o registro
 * de verdade é o `DETERMINISTIC` do orquestrador, que puxa `pdftotext` e não entra no cliente).
 * ⛔ Um teste exige que os dois sejam IGUAIS — a tela nunca promete um banco que o leitor não lê.
 */
export const BANCOS_COM_LEITOR = ['Sicredi', 'Banrisul', 'Caixa', 'Mercado Pago'] as const
