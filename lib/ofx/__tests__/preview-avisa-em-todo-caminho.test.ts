// GUARD ESTRUTURAL (29/08/2026) — o aviso tem que sair em TODOS os caminhos do preview.
//
// ⚠️ POR QUE ESTE É ESTRUTURAL E NÃO COMPORTAMENTAL (a REGRA 3 pede comportamento): o
// caminho real exige HTTP + multipart + banco + sessão, que a suíte não alcança — a prova
// de comportamento desta rota mora em `scripts/` contra prod. O que dá pra travar aqui é
// a invariante que EU acabei de violar sozinho, e que é de ESTRUTURA:
//
//   a 1ª versão devolveu `avisoExportMesmoDia` só no return do V2. O preview tem TRÊS
//   returns (legado · re-import vazio · V2), e o re-import vazio é justamente o caso em
//   que o dono vê "nenhuma transação nova" e precisa saber se é porque o dia não fechou.
//   Descobri isso na prova em prod, não no código.
//
// É a família do "N caminhos, 1 esquecido" (motor de transferência, gatilho de vendas,
// estorno de cartão). O marcador `bankProfile: bankProfilePayload` identifica um return
// do preview: quem devolve o perfil do banco devolve o aviso também.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rota = readFileSync(
  join(__dirname, '..', '..', '..', 'app/api/contas-bancarias/[id]/importar-ofx/route.ts'),
  'utf-8',
)

describe('⭐ todo return do preview leva o aviso de export de mesmo dia', () => {
  // ⛔⛔ 05/09: o SELO nasceu em 04/09 e entrou só no return do V2 — o dono subiu um OFX
  // já importado ("0 novas"), caiu no return do meio e **a faixa de anexar o PDF não
  // existia**. Conferir não depende de ter linha nova; depende de ter régua. O guard de
  // 29/08 travava só o aviso, e por isso não pegou. Agora trava os dois.
  it('⛔⛔ os 3 caminhos devolvem o SELO — inclusive o de "0 novas"', () => {
    const retornosDePreview = (rota.match(/bankProfile: bankProfilePayload/g) ?? []).length
    const comSelo = (rota.match(/selo: seloPayload/g) ?? []).length
    expect(retornosDePreview).toBeGreaterThanOrEqual(3)
    expect(comSelo, 'caminho de preview sem selo → a faixa do PDF some naquele estado').toBe(retornosDePreview)
  })

  it('⚠️ e o selo é calculado UMA vez, FORA dos ramos (senão eles divergem)', () => {
    expect((rota.match(/const selo = decidirSelo\(/g) ?? []).length).toBe(1)
    expect((rota.match(/await conferirComPdf\(/g) ?? []).length, 'duas conferências = duas verdades').toBe(1)
  })

  it('⭐⭐ os 3 caminhos (legado · re-import vazio · V2) devolvem o campo', () => {
    const retornosDePreview = (rota.match(/bankProfile: bankProfilePayload/g) ?? []).length
    const comAviso = (rota.match(/avisoExportMesmoDia: avisoMesmoDiaPayload/g) ?? []).length
    expect(retornosDePreview).toBeGreaterThanOrEqual(3)
    expect(comAviso).toBe(retornosDePreview) // caminho novo sem o aviso → vermelho aqui
  })

  it('⚠️ o aviso é calculado UMA vez (não recopiado por caminho — senão eles divergem)', () => {
    expect((rota.match(/avisoExportMesmoDia\(\s*$/gm) ?? []).length).toBeLessThanOrEqual(1)
    expect(rota).toMatch(/const avisoMesmoDiaCalc = avisoExportMesmoDia\(/)
  })

  it('o diagnóstico guiado só roda quando o gate ACUSA (no verde seria ruído e custo)', () => {
    expect(rota).toMatch(/ledgerBalCheck\.available && !\w*[Vv]2Payload\.ledgerBalCheck\.bate/)
  })
})
