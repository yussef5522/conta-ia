/**
 * ⭐⭐⭐ O GESTO DE CONFERIR — **UM lugar monta o corpo, dois lugares chamam** (09/10/2026).
 *
 * **Por que isto existe:** com o cartão-placar (Parte 2), o **✓ confirma em UM toque** direto
 * do cartão (modo rajada) e o **✏️ abre o painel** pra corrigir. São dois chamadores da MESMA
 * rota — e se cada um montasse o próprio `body`, eles divergiriam no primeiro campo novo.
 *
 * ⛔⛔ **E a rota é `.strict()`**: campo desconhecido devolve **400**. Dois montadores
 * significaria dois jeitos de errar o payload, e o erro apareceria como *"Gesto inválido"* na
 * cara do gerente no meio de uma rajada. ***Uma decisão, uma função*** — a lição do B1 aplicada
 * ao corpo de um POST.
 *
 * ⚠️ Ele NÃO decide permissão nem regra: quem recusa é o servidor (`stock.manage` + sessão
 * pessoal + os quatro olhos), e a recusa vem com o motivo escrito.
 */
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

export const MOTIVOS_DA_TELA = [
  { chave: 'CONTOU_ERRADO', rotulo: 'contou errado' },
  { chave: 'DIGITOU_ERRADO', rotulo: 'digitou errado' },
  { chave: 'OUTRO', rotulo: 'outro' },
] as const

export type MotivoDaTela = (typeof MOTIVOS_DA_TELA)[number]['chave']

const rotaDe = (id: string) => `/api/empresas/${id}/estoque/producao/conferencia`

export interface RespostaDoCarimbo {
  ok: boolean
  conferidoPorNome?: string
  erro?: string
}

/**
 * ⭐ (a) CONFIRMAR — **um toque**, sem PIN (o carimbo assina pela SESSÃO, correção de 09/10).
 *
 * ⚠️ Teto de GRAVAÇÃO (60 s), não o de leitura: *desistir cedo de uma escrita que está
 * acontecendo é pior que esperar* (a régua de 14/09).
 */
export async function confirmarNaRota(id: string, conclusaoId: string): Promise<RespostaDoCarimbo> {
  const r = await fetchComTimeout<{ conferidoPorNome: string }>(rotaDe(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'CONFIRMAR', conclusaoId }),
    timeoutMs: 60_000,
  })
  if (!r.ok || !r.data) return { ok: false, erro: r.erro ?? 'não consegui gravar' }
  return { ok: true, conferidoPorNome: r.data.conferidoPorNome }
}

/** ⭐ (b) CORRIGIR — mesma porta de sempre (versão nova, rastro, delta). Só a roupa muda. */
export async function corrigirNaRota(
  id: string,
  e: { conclusaoId: string; qtdCerta: number; motivo: MotivoDaTela; observacao?: string },
): Promise<RespostaDoCarimbo> {
  const r = await fetchComTimeout<{ conferidoPorNome: string }>(rotaDe(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acao: 'CORRIGIR',
      conclusaoId: e.conclusaoId,
      qtdCerta: e.qtdCerta,
      motivo: e.motivo,
      observacao: e.observacao || undefined,
    }),
    timeoutMs: 60_000,
  })
  if (!r.ok || !r.data) return { ok: false, erro: r.erro ?? 'não consegui gravar' }
  return { ok: true, conferidoPorNome: r.data.conferidoPorNome }
}

export interface PreviaDaCorrecao {
  ok: boolean
  frase?: string
  erro?: string
}

/**
 * ⭐ (c) A PRÉVIA — leitura pura, e ela sai do MESMO motor que vai executar.
 *
 * ⛔ Uma conta própria aqui prometeria um saldo que a gravação não produz — o invariante
 * circular de 28/08, em forma de preview.
 */
export async function preverNaRota(
  id: string,
  e: { conclusaoId: string; qtdCerta: number; produto: string; unidade: string },
): Promise<PreviaDaCorrecao> {
  const r = await fetchComTimeout<{
    modo: string
    preview?: { saldoAntes: number; saldoDepois: number }
    porque?: string
  }>(rotaDe(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'PREVER_CORRECAO', conclusaoId: e.conclusaoId, qtdCerta: e.qtdCerta }),
  })
  if (!r.ok || !r.data) return { ok: false, erro: r.erro ?? 'não consegui prever' }
  const d = r.data
  return {
    ok: true,
    frase: d.modo === 'ESTORNA_E_RELANCA' && d.preview
      ? `o estoque de «${e.produto}» vai de ${d.preview.saldoAntes} pra ${d.preview.saldoDepois} ${e.unidade}`
      : `o estoque NÃO se mexe — ${d.porque ?? 'só a conclusão é corrigida'}`,
  }
}
