// ⭐⭐⭐ A RECUSA QUE AJUDA A CONSERTAR (16/09/2026) — peça 4.
//
// **A régua do dono:** *"a conferência de totais FICA (é a heroína de hoje), e o erro ganha
// diagnóstico: além do 'esperado × lido', mostra A REGIÃO suspeita do texto cru — as linhas
// ao redor de onde a soma se perdeu. A dif de −18,00 é provavelmente UMA transação de 18,00
// não lida; me mostra ela."*
//
// ⛔ **O que isto NÃO faz: relaxar a conferência.** Ela recusou hoje e estava certa. O que
// muda é o que a recusa **entrega junto** — hoje o dono recebe dois números e fica sem saber
// onde procurar; com isto ele recebe **as linhas candidatas**.

/** ⭐ uma linha do texto cru que pode ser a que faltou */
export interface LinhaSuspeita {
  /** número da linha no texto extraído — pra achar no arquivo */
  numero: number
  texto: string
  /** o valor que casa com a diferença, se esta linha tiver um */
  valor: number
  /** por que ela é suspeita */
  porQue: string
}

export interface DiagnosticoDaRecusa {
  diferenca: number
  /** ⭐ as linhas cujo valor bate com a diferença — as mais prováveis primeiro */
  candidatas: LinhaSuspeita[]
  /** ⚠️ quando nada bate, isto DIZ isso em vez de devolver lista vazia muda */
  resumo: string
}

const NUM = /(-?\s*)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/g

function valoresDaLinha(linha: string): number[] {
  const out: number[] = []
  for (const m of linha.matchAll(NUM)) {
    const v = Number(`${m[2]!.replace(/\./g, '')}.${m[3]}`)
    if (!isNaN(v)) out.push(v)
  }
  return out
}

/**
 * ⭐⭐ ACHA A LINHA QUE EXPLICA A DIFERENÇA.
 *
 * **A aposta que o dono fez é a certa e é a primeira que se testa:** uma diferença de
 * −18,00 é, quase sempre, **UMA transação de 18,00 que o parser não leu**. Então a busca
 * começa pelo valor exato.
 *
 * ⚠️ **E ela NÃO conserta nada sozinha** — só aponta onde olhar. Somar a linha achada seria
 * o sistema inventando a transação que ele não soube ler, que é o oposto da régua da casa
 * (*"não inventar dado que o arquivo não traz"*).
 */
export function diagnosticarRecusa(textoCru: string, diferenca: number): DiagnosticoDaRecusa {
  const alvo = Math.abs(Math.round(diferenca * 100) / 100)
  const linhas = textoCru.split(/\r?\n/)
  const candidatas: LinhaSuspeita[] = []

  if (alvo > 0) {
    // ── 1. valor EXATO: a hipótese mais provável ──
    linhas.forEach((texto, i) => {
      for (const v of valoresDaLinha(texto)) {
        if (Math.abs(v - alvo) <= 0.005) {
          candidatas.push({
            numero: i + 1, texto: texto.trim().slice(0, 160), valor: v,
            porQue: `valor EXATO da diferença (${alvo.toFixed(2)}) — é a transação que provavelmente não foi lida`,
          })
          return
        }
      }
    })

    /**
     * ⚠️ 2. A METADE. Diferença que é o DOBRO de um valor costuma ser linha contada com
     * sinal trocado (ela deveria subtrair e somou) — a família do estorno esquecido, que a
     * REGRA 6 existe pra pegar.
     */
    if (candidatas.length === 0) {
      const metade = Math.round((alvo / 2) * 100) / 100
      linhas.forEach((texto, i) => {
        for (const v of valoresDaLinha(texto)) {
          if (Math.abs(v - metade) <= 0.005) {
            candidatas.push({
              numero: i + 1, texto: texto.trim().slice(0, 160), valor: v,
              porQue: `METADE da diferença (${metade.toFixed(2)}) — linha pode estar somando onde deveria subtrair (estorno?)`,
            })
            return
          }
        }
      })
    }
  }

  const resumo = candidatas.length > 0
    ? `${candidatas.length} linha(s) do PDF têm o valor da diferença — provavelmente é uma delas que não foi lida.`
    : `Nenhuma linha isolada bate com ${alvo.toFixed(2)}: a diferença deve vir de VÁRIAS linhas `
      + '(ou de uma seção inteira não reconhecida — layout novo?).'

  return { diferenca, candidatas: candidatas.slice(0, 8), resumo }
}

/**
 * ⭐ AS LINHAS AO REDOR — o dono pediu *"a REGIÃO suspeita do texto cru"*.
 * ⚠️ O contexto importa: a linha sozinha muitas vezes não diz nada, e é a vizinha que
 * mostra que ali começou uma seção que o parser não conhece.
 */
export function regiaoAoRedor(textoCru: string, numeroDaLinha: number, raio = 3): string {
  const linhas = textoCru.split(/\r?\n/)
  const ini = Math.max(0, numeroDaLinha - 1 - raio)
  const fim = Math.min(linhas.length, numeroDaLinha + raio)
  return linhas.slice(ini, fim)
    .map((l, i) => `${String(ini + i + 1).padStart(4)} ${ini + i + 1 === numeroDaLinha ? '▶' : ' '} ${l}`)
    .join('\n')
}

/**
 * ⭐⭐ A MENSAGEM COMPLETA DA RECUSA — *"esperado × lido"* **mais** onde olhar.
 *
 * ⛔ Ela continua sendo uma RECUSA: nada grava. A diferença é que o dono sai dela sabendo
 * o que procurar, em vez de sair com dois números.
 */
export function mensagemDaRecusa(
  o: { rotulo: string; esperado: number; lido: number; textoCru: string },
): string {
  const dif = Math.round((o.lido - o.esperado) * 100) / 100
  const d = diagnosticarRecusa(o.textoCru, dif)
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const partes = [
    `${o.rotulo}: o PDF declara ${brl(o.esperado)} e a soma das linhas deu ${brl(o.lido)} `
    + `(diferença de ${brl(Math.abs(dif))} ${dif < 0 ? 'a menos' : 'a mais'}).`,
    d.resumo,
  ]

  for (const c of d.candidatas.slice(0, 3)) {
    partes.push(`  linha ${c.numero}: "${c.texto}" — ${c.porQue}`)
  }

  return partes.join('\n')
}
