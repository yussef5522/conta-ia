/**
 * ⛔⛔⛔ A TELA DE COMPLEMENTOS NÃO CALA, E NÃO DESAPARECE DURANTE A CARGA (20/10/2026).
 *
 * **A caça de 19/10 ~01h achou o servidor SÃO e a tela mentindo:** a lista de dias levava ~12 s
 * (o N+1 que morreu hoje) e o card **DESAPARECIA enquanto carregava** (`return null`); no
 * sucesso do import a revisão reabria igual e a lista não recarregava; e **4 gestos falhavam em
 * silêncio**.
 *
 * ⭐⭐ A CICATRIZ QUE FICA: ***tela que SOME durante a carga = tela que parece travada.***
 * Card ausente é indistinguível de card que não existe — o dono abre, não vê nada, e conclui
 * que não há dia importado. É a família do *"spinner eterno é a ausência fingindo progresso"*
 * (14/09) e do *"erro disfarçado de vazio"*, agora na forma mais crua: nem spinner havia.
 *
 * ⚠️ Guard ESTRUTURAL e assumido como tal: o projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar nem medir DOM aqui. Ele trava **a forma** dos quatro silêncios e do estado
 * de carga; o olho do dono é REGRA 2.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, blocoEntre } from './_leitura-de-fonte'

const CAMINHO = join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx')
/**
 * ⚠️ LIDO SEM COMENTÁRIO, de propósito: este arquivo documenta no próprio texto os defeitos
 * que ele matou (o `return null`, o `.catch(() => setDias([]))`, a frase de conexão cravada).
 * ***O arquivo que documenta o defeito não pode ser o que o absolve*** — a cicatriz de 21/09.
 */
const TELA = semComentarios(readFileSync(CAMINHO, 'utf-8'))

/** o componente da lista de dias, recortado — asserção no vizinho é falso verde */
const BAIXA = blocoEntre(TELA, 'function BaixaComplementos(', '\nfunction ')

describe('⭐⭐ a peça 3 — o card NÃO desaparece durante a carga', () => {
  it('o estado da carga é EXPLÍCITO (carregando · falhou · ok), nunca um `| null`', () => {
    expect(TELA, 'o tipo da carga é o que torna "ainda não sei" distinto de "não tem"').toContain('type CargaDosDias')
    for (const estado of ["'CARREGANDO'", "'FALHOU'", "'OK'"]) {
      expect(TELA, `o estado ${estado} tem que existir no tipo`).toContain(estado)
    }
  })

  it('⛔ o `return null` por ausência de DADO morreu — ele volta SÓ quando não há dia', () => {
    expect(BAIXA, 'era este o defeito: o card sumia durante os ~12 s da lista').not.toContain('if (dias === null || !dias.length) return null')
    // ⭐ e o `null` de "sem dia importado" FICA: ali o card não existe mesmo, e um bloco
    // vazio dizendo "nada aqui" seria móvel permanente numa tela de trabalho.
    expect(BAIXA).toContain('if (!dias.length) return null')
  })

  it('⭐ CARREGANDO desenha o card com esqueleto, e FALHOU oferece tentar de novo', () => {
    expect(BAIXA).toMatch(/carga\.estado === 'CARREGANDO'/)
    expect(BAIXA, 'o esqueleto é o que mantém o card na tela').toContain('animate-pulse')
    expect(BAIXA).toMatch(/carga\.estado === 'FALHOU'/)
    expect(BAIXA, 'estado de erro sem saída é um beco').toContain('tentar de novo')
  })
})

describe('⛔ o 3º silêncio — falha de carga NUNCA vira lista vazia', () => {
  it('o `.catch(() => setDias([]))` morreu', () => {
    expect(BAIXA, 'rede caindo ficava IDÊNTICA a "não tem dia importado"').not.toContain('setDias([])')
  })

  it('a carga tem TETO DE TEMPO e a falha vira ESTADO com frase', () => {
    const carregar = blocoEntre(BAIXA, 'const carregar = async () => {', '\n  }')
    expect(usosDe(carregar, 'fetchComTimeout'), 'sem teto, a lista de 12 s girava pra sempre').toBeGreaterThanOrEqual(1)
    expect(carregar).toContain("estado: 'FALHOU'")
    // ⚠️ `erro: null` com `ok: false` = abort externo (o componente desmontou) — ali mostrar
    // erro seria ruído numa tela que já não existe.
    expect(carregar, 'a tela não grita quando ela própria desmontou').toContain('if (r.erro)')
  })
})

describe('⛔ o 2º silêncio — o confirmar da baixa ganhou catch', () => {
  const confirmar = blocoEntre(BAIXA, 'const confirmar = async () => {', '\n  }')

  it('existe catch, e a frase passa pelo tradutor', () => {
    expect(confirmar, 'era `try { … } finally` — rede caindo voltava ao normal sem dizer nada').toContain('} catch (e) {')
    expect(usosDe(confirmar, 'fraseDoErro')).toBeGreaterThanOrEqual(1)
  })

  it('⭐ o teto é de 60 s, como todo gesto que GRAVA', () => {
    expect(confirmar, 'desistir cedo de uma escrita que está acontecendo é pior que esperar').toContain('timeoutMs: 60_000')
  })
})

describe('⛔ o 1º silêncio — o catch do import de complementos', () => {
  it('a frase de conexão só sai quando é rede DE VERDADE', () => {
    const importa = blocoEntre(TELA, 'function ImportComplementos(', '\nfunction ')
    expect(importa, 'qualquer throw virava "problema de rede" e o dono caçava a internet dele')
      .not.toContain("catch { setErro('Não consegui falar com o servidor.')")
    expect(usosDe(importa, 'fraseDoErro'), 'quem decide a frase é o tradutor, não o catch').toBeGreaterThanOrEqual(1)
  })
})

describe('⛔⛔ o 4º silêncio — "não consegui apurar" NUNCA cai em "pendente"', () => {
  it('a tela desenha o estado próprio, ANTES de baixado/pendente', () => {
    expect(BAIXA, 'o campo tem que chegar na tela — no servidor ele já existe').toContain('!d.apurado')
    expect(BAIXA).toContain('não consegui apurar')

    // ⭐ a ORDEM é o que importa: lido depois de `baixado`, um dia não-apurado continuaria
    // aparecendo como "pendente — não baixou", que é a AFIRMAÇÃO falsa que o campo mata.
    const estado = blocoEntre(BAIXA, "<td className=\"px-3 py-0 text-[13px]\">", '</td>')
    const posApurado = estado.indexOf('!d.apurado')
    const posBaixado = estado.indexOf('d.baixado')
    const posPendente = estado.indexOf('pendente — não baixou')
    expect(posApurado).toBeGreaterThan(-1)
    expect(posApurado, '"não consegui apurar" vem antes de "baixado"').toBeLessThan(posBaixado)
    expect(posApurado, '"não consegui apurar" vem antes de "pendente"').toBeLessThan(posPendente)
  })
})

describe('⭐⭐ a peça 2 — o import RENOVA a lista no sucesso', () => {
  it('o `onImportado` dos complementos bumpa o recarregamento junto', () => {
    const chamada = blocoEntre(TELA, '<ImportComplementos', '/>')
    expect(chamada, 'a linha do dia continuava dizendo "pendente" até o dono mexer em algo')
      .toContain('setRecargaComp')
    // ⛔ e NÃO pode depender de a revisão aplicar algo: `onMudou` é um gesto que o dono pode
    // não dar, e o estado da lista não pode ficar refém dele.
    expect(chamada).toContain('setRevisao(')
  })
})
