// ⛔⛔⛔ O CARTEIRO DO VÍNCULO — a rede que impede a ficha ÓRFÃ (10/05/2026).
//
// O BUG: a revisão do import mandava `?mapearComplemento=<nome>` e o editor lia
// `?complemento=`. **Nome inventado de um lado, lido do outro: NINGUÉM casava** → o POST ia
// com `mapearComplemento: null`, a ficha nascia SEM VÍNCULO, a revisão seguia dizendo "sem
// destino" e a venda daquele sabor NÃO baixava estoque. Outubro: 5 sabores com ficha e 0
// vínculo · 266 vendas sem baixa.
//
// ⭐ ESTE ARQUIVO É O LADO PURO: `nomesDeComplementoDaUrl` é o ÚNICO leitor de "quais nomes do
// PDV esta ficha mapeia", e aceita as DUAS grafias. O lado que PROVA O GESTO (ficha + vínculo
// na MESMA transação, revisão devolvendo VINCULADO) é o `.integration.test.ts` irmão.
//
// ⚠️ A FIXTURE TEM O CAMPO PREENCHIDO, de propósito: **campo zerado passa verde com a régua
// certa E com a errada** — era o que deixava o buraco invisível. Aqui o contrafactual é
// explícito: a régua VELHA (`getAll('complemento')` na mão) devolve LISTA VAZIA na URL real
// que a revisão monta, e lista vazia é exatamente o `mapearComplemento: null` do POST.

import { describe, it, expect } from 'vitest'
import { nomesDeComplementoDaUrl } from '../voltar-ficha'

/** A URL REAL que a revisão do import monta (o caso de 10/05). */
const URL_DA_REVISAO = 'nome=NAPOLITANA&mapearComplemento=NAPOLITANA&tipo=SABOR'

describe('o carteiro do vínculo: nomesDeComplementoDaUrl', () => {
  it('⛔ O CONTRAFACTUAL DO DEFEITO: a régua VELHA devolve VAZIO na URL da revisão', () => {
    const qp = new URLSearchParams(URL_DA_REVISAO)
    // era isto que o editor fazia na mão — e `[]` vira `mapearComplemento: null` no POST
    expect(qp.getAll('complemento')).toEqual([])
    // ⭐ a rede única lê o alias e o nome chega
    expect(nomesDeComplementoDaUrl(qp)).toEqual(['NAPOLITANA'])
  })

  it('lê o alias `mapearComplemento` (o sender da revisão do import)', () => {
    expect(nomesDeComplementoDaUrl(new URLSearchParams('mapearComplemento=CALABRESA'))).toEqual(['CALABRESA'])
  })

  it('lê `complemento` (a convenção do cardápio e da volta-da-revisão)', () => {
    expect(nomesDeComplementoDaUrl(new URLSearchParams('complemento=CALABRESA'))).toEqual(['CALABRESA'])
  })

  it('getAll nos DOIS: o link do grupo manda um nome POR GRAFIA', () => {
    const qp = new URLSearchParams('complemento=4+QUEIJOS&complemento=4%20queijos')
    expect(nomesDeComplementoDaUrl(qp)).toEqual(['4 QUEIJOS', '4 queijos'])
  })

  it('DEDUP: as duas grafias podem vir juntas no mesmo link (o sender antigo E o novo)', () => {
    // mapear o MESMO nome 2× no mesmo gesto é pedir pro upsert brigar com ele mesmo
    const qp = new URLSearchParams('complemento=NAPOLITANA&mapearComplemento=NAPOLITANA')
    expect(nomesDeComplementoDaUrl(qp)).toEqual(['NAPOLITANA'])
  })

  it('TRIM, e nome só-espaço não vira vínculo', () => {
    expect(nomesDeComplementoDaUrl(new URLSearchParams('mapearComplemento=%20%20NAPOLITANA%20%20'))).toEqual(['NAPOLITANA'])
    expect(nomesDeComplementoDaUrl(new URLSearchParams('mapearComplemento=%20%20%20'))).toEqual([])
  })

  it('sem query nenhuma devolve lista vazia (e `null` não explode — SSR não tem URL)', () => {
    expect(nomesDeComplementoDaUrl(new URLSearchParams(''))).toEqual([])
    expect(nomesDeComplementoDaUrl(null)).toEqual([])
    expect(nomesDeComplementoDaUrl(undefined)).toEqual([])
  })

  it('a ORDEM é `complemento` primeiro: a convenção manda, o alias completa', () => {
    const qp = new URLSearchParams('mapearComplemento=B&complemento=A')
    expect(nomesDeComplementoDaUrl(qp)).toEqual(['A', 'B'])
  })
})
