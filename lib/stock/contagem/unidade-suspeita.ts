// ⚠️ UNIDADE SUSPEITA — item CONTÁVEL com saldo FRACIONADO (31/08/2026).
//
// CASO REAL: `BOBINA 02 LITROS 21X31CM` está com **1,86 UN**. Não foi baixa indevida — a
// NOTA cobrou fração (`qCom 0,93 Pc` e `0,926 Pc`, porque o fornecedor fatura a bobina por
// PESO) e o `Pc` entrou 1:1 como `UN` no catálogo.
//
// ⛔ O ESTRAGO NA CONTAGEM: ela vai contar **2 rolos**, o sistema diz 1,86, e nasce uma
// divergência de 0,14 que **não é falta de mercadoria — é o cadastro**. Sem o aviso, essa
// linha vira uma investigação atrás de 0,14 rolo de bobina que nunca existiu.
//
// ⚠️ AVISA, NÃO TRAVA, e NÃO CORRIGE: reunitizar pra KG ou relançar em rolos inteiros é
// decisão do dono, e mexe no ledger. Aqui a tela só diz "olha, essa divergência pode ser
// do cadastro" — a mesma disciplina do mínimo sanitário da etiqueta.

/** unidades em que meia peça não existe fisicamente */
const CONTAVEL = /^(UN|UND|PC|PCT|CX|DZ|PAR)$/i

const EPS = 1e-9

export function ehUnidadeContavel(unidade: string): boolean {
  return CONTAVEL.test((unidade ?? '').trim())
}

/**
 * O saldo do sistema é fracionado numa unidade que não admite fração?
 * ⚠️ Saldo ZERO não é suspeito (item novo), e unidade de peso/volume nunca é.
 */
export function unidadeSuspeita(unidade: string, saldoSistema: number): boolean {
  if (!ehUnidadeContavel(unidade)) return false
  if (!Number.isFinite(saldoSistema) || saldoSistema === 0) return false
  return Math.abs(saldoSistema - Math.round(saldoSistema)) > EPS
}

/** o texto que a tela mostra — diz o que fazer, não só que há algo errado */
export function avisoUnidadeSuspeita(unidade: string, saldoSistema: number): string | null {
  if (!unidadeSuspeita(unidade, saldoSistema)) return null
  return `O sistema tem ${saldoSistema} ${unidade.toUpperCase()} — fração numa unidade que se conta inteira. ` +
    'A divergência aqui pode ser do CADASTRO, não do estoque: conte normal e me avise.'
}
