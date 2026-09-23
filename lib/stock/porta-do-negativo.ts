/**
 * ⭐⭐⭐ A PORTA DO ITEM NEGATIVO — *"recusa sem porta é beco sem saída"* (22/09/2026).
 *
 * **O caso do dono:** ele contou a `PORÇAO CALABRESA 85g congelada` (saldo **−8 UN**,
 * valor **−R$ 135,20**) e a recusa disse *"falta registrar a COMPRA que não foi lançada"*.
 *
 * ⛔⛔ **E NINGUÉM COMPRA PORÇÃO DE CALABRESA — ela se PRODUZ.** A frase nasceu do caso do
 * **fermento** (16/09), que é matéria-prima: lá o buraco era mesmo uma nota de compra. Ao
 * cravá-la pra todo item negativo, a recusa passou a mandar o dono procurar uma nota que
 * não existe — ***mensagem que acusa o campo errado faz o dono caçar um erro que não
 * existe***, a mesma lição de 16/09 cometida um degrau acima.
 *
 * ⭐ **E O PORQUÊ IMPORTA MAIS QUE A RECUSA:** item PRODUZIDO negativo significa
 * **vendeu sem ter produção registrada**. Contar por cima **enterra o lote perdido** — o
 * ajuste entra, o saldo fecha, e a produção que ninguém lançou some pra sempre do Real vs
 * Teórico. A recusa existe pra impedir exatamente isso, então ela tem que DIZER isso.
 *
 * ⛔ **A régua NÃO mudou** (ordem do dono: *"FIX na mensagem, não na régua"*). O guard de
 * 11/09 continua recusando o mesmo estado impossível; o que muda é a frase e a porta.
 */
import { TIPOS_FICHA } from './tipos-ficha'

/** ⭐ o que a cozinha FAZ × o que o caminhão TRAZ — decide a frase e a porta */
export type FamiliaDoItem = 'PRODUZIDO' | 'COMPRADO'

/**
 * ⚠️ A família sai da CATEGORIA do item, que é a natureza declarada dele — não da
 * existência de ficha. Item produzido cuja ficha foi arquivada **continua** produzido, e
 * mandá-lo pra "registrar a compra" seria o bug de hoje de novo, por outro caminho.
 *
 * ⭐ REGRA 4: a lista de tipos produzidos tem dono único (`tipos-ficha.ts`) — reescrevê-la
 * aqui faria o dia do `SABOR` (que nasceu INTERMEDIARIO e virou tipo próprio em 03/09)
 * divergir entre dois arquivos.
 */
export function familiaDoItem(categoria: string | null | undefined): FamiliaDoItem {
  return categoria && (TIPOS_FICHA as readonly string[]).includes(categoria) ? 'PRODUZIDO' : 'COMPRADO'
}

export interface FatosDoNegativo {
  empresaId: string
  itemId: string
  nome: string
  /** unidade de controle, pra frase falar a língua do item */
  unidade: string
  /** o saldo ANTES deste movimento — é ele que está negativo */
  saldoAntes: number
  familia: FamiliaDoItem
  /** ⭐ a ordem PARADA deste item, quando existe: a porta mais curta */
  ordemAberta?: { id: string; dia: string } | null
  /** a ficha ATIVA que o produz — a 2ª porta */
  fichaAtivaId?: string | null
}

export interface PortaDaRecusa {
  rotulo: string
  href: string
}

/**
 * ⭐⭐ O PORQUÊ, na língua da casa. É a metade que o dono pediu primeiro: *"a recusa diz
 * só 'estoque negativo, não aceita' — sem explicar POR QUE nem O QUE FAZER"*.
 */
export function porQueEstaNegativo(f: FatosDoNegativo): string {
  const qtd = `${f.saldoAntes} ${f.unidade}`.trim()
  if (f.familia === 'PRODUZIDO') {
    return `«${f.nome}» está negativo (${qtd}) porque vendeu sem ter produção registrada. `
      + 'Contar por cima ENTERRA o lote que ninguém lançou — por isso a contagem espera.'
  }
  return `«${f.nome}» está negativo (${qtd}) porque saiu mais do que entrou — falta registrar `
    + 'a COMPRA que não foi lançada. Não é a sua contagem que está errada.'
}

/**
 * ⭐⭐ A PORTA — **sempre existe uma**. Três casos, em ordem de quão perto ela está do
 * gesto que resolve:
 *
 * 1. **ordem parada deste item** → link DIRETO nela (pedido do dono). É o caso mais
 *    curto: o trabalho já foi planejado, só falta concluir.
 * 2. **ficha ativa** → abrir a produção **com a ficha já escolhida**. ⚠️ Sem o `?ficha=`
 *    o dono cairia num dropdown pra procurar de novo o que o sistema acabou de nomear —
 *    o defeito do Bamberg (13/09).
 * 3. **nem ordem nem ficha** (ou item COMPRADO) → a entrada/ajuste com motivo, pelo
 *    histórico do item. ⛔ *"beco sem saída"* é o único desfecho proibido.
 */
export function portaDoNegativo(f: FatosDoNegativo): PortaDaRecusa {
  const base = `/empresas/${f.empresaId}/estoque`
  if (f.familia === 'PRODUZIDO' && f.ordemAberta) {
    return { rotulo: `concluir a ordem aberta de ${f.ordemAberta.dia}`, href: `${base}/producao/${f.ordemAberta.id}` }
  }
  if (f.familia === 'PRODUZIDO' && f.fichaAtivaId) {
    return { rotulo: 'registrar a produção que faltou', href: `${base}/producao?ficha=${f.fichaAtivaId}` }
  }
  return {
    rotulo: f.familia === 'PRODUZIDO'
      // ⚠️ produzido SEM ficha não tem como "registrar a produção" — a saída honesta é a
      // entrada com motivo, e o histórico é onde ela se decide.
      ? 'ver o histórico e lançar a entrada que faltou'
      : 'ver o histórico deste item e corrigir a entrada que faltou',
    href: `${base}/itens/${f.itemId}`,
  }
}
