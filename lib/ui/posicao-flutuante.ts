// ⭐⭐⭐ ONDE UM PAINEL FLUTUANTE CABE — a conta que o portal precisa (23/10/2026).
//
// ⚠️⚠️ **ELA NÃO NASCEU HOJE: veio de `lib/conciliacao/posicao-do-menu.ts` (18/09).** O
// defeito original, medido em prod: o dono clicou *"parcela de empréstimo"* e o seletor abriu
// **sem nenhum contrato** — com a empresa tendo 10, e o nginx provando que o dado CHEGOU
// (`GET …/emprestimos → 200 · 8024 bytes`). A causa era **CSS, não dado**: o cartão ≍ é
// `overflow-hidden` e o menu era `absolute` DENTRO dele → **recortado pela borda**.
// ***Menu que abre fora da vista é indistinguível de menu vazio.***
//
// ⛔⛔ **E `z-index` NÃO RESOLVE ISSO — é regra de CSS, não preferência.** `overflow: hidden`
// num ancestral **recorta** o descendente `absolute` qualquer que seja o `z-index`; o
// `z-index` só ordena pintura entre stacking contexts. **Só o portal** (ou mexer no overflow
// do ancestral, que mataria o `rounded-[16px]` do card) tira o painel do recorte.
//
// ⭐ **POR QUE ELA MUDOU DE CASA (23/10):** o seletor de item do Real × Teórico caiu no MESMO
// defeito, dentro de `overflow-hidden` de outro card. A pergunta — *"onde cabe um painel
// ancorado num elemento?"* — **não é de conciliação**: é de UI. Escrever a 2ª cópia aqui seria
// a doença que este repo mais paga, então ela veio pra `lib/ui/` e
// `lib/conciliacao/posicao-do-menu.ts` virou **re-export** — os dois importadores de lá
// seguem funcionando sem uma linha tocada.
//
// ⚠️ A conta mora aqui, PURA e testável — *regra que mora num `style={{}}` é regra que
// ninguém prova*.

export interface Retangulo { left: number; top: number; bottom: number; width: number }
export interface Janela { largura: number; altura: number }

export interface PosicaoFlutuante {
  left: number
  /** posicionado pelo topo (abre pra baixo) ou pela base (abre pra cima) */
  top?: number
  bottom?: number
  largura: number
  maxAltura: number
  /** ⭐ pra tela poder dizer o que fez, e pro teste afirmar */
  lado: 'ABAIXO' | 'ACIMA'
}

const MARGEM = 12
const ALTURA_MIN = 160

/** o teto de 320 do menu de AÇÕES (o de 18/09) — conservado como default */
const LARGURA_MAX_PADRAO = 320

export interface ReguaDaLargura {
  /**
   * ⭐ piso de largura. O menu de ações não tem (um menu de 200px serve); o **seletor de
   * busca** tem, porque caixa mais estreita que o campo quebra o nome do item em duas linhas
   * — foi exatamente o que o print de 23/10 mostrou.
   */
  minima?: number
  /** teto. Default 320 (o do menu de ações). */
  maxima?: number
}

/**
 * ⭐ Decide onde o painel cabe, com a régua que o dono espera:
 *
 *  · **abre pra baixo** quando há espaço; **pra cima** quando o de baixo é apertado e o de
 *    cima é maior — controle no rodapé da tela não pode abrir num vão de 40px;
 *  · **nunca sangra pela direita** (no celular o controle fica perto da borda);
 *  · a altura máxima é o **espaço REAL** que sobra, não um número fixo — foi um número fixo
 *    dentro de um ancestral que corta que produziu o menu "vazio";
 *  · a largura nunca é menor que o elemento âncora. ⚠️ Num seletor de busca, caixa mais
 *    estreita que o campo é o defeito do print; e num celular de 390px o piso de 420 **não
 *    cabe** — aí a janela manda (a margem é inviolável, senão sangra).
 */
export function posicaoFlutuante(ancora: Retangulo, janela: Janela, regua: ReguaDaLargura = {}): PosicaoFlutuante {
  const cabeNaJanela = janela.largura - MARGEM * 2
  const teto = Math.min(regua.maxima ?? LARGURA_MAX_PADRAO, cabeNaJanela)
  // ⭐ o piso considera o próprio elemento: a caixa acompanha o campo quando ele é maior que
  //    o mínimo pedido. ⛔ E tudo isso ainda é limitado por `cabeNaJanela` — no celular o
  //    piso de 420 cede pra margem, nunca o contrário.
  const piso = Math.min(Math.max(regua.minima ?? 0, ancora.width), cabeNaJanela)
  const largura = Math.max(teto, piso)
  const left = Math.max(MARGEM, Math.min(ancora.left, janela.largura - largura - MARGEM))

  const espacoAbaixo = janela.altura - ancora.bottom - MARGEM
  const espacoAcima = ancora.top - MARGEM

  // ⛔ só sobe quando o de baixo é apertado E o de cima é de fato melhor
  if (espacoAbaixo < ALTURA_MIN && espacoAcima > espacoAbaixo) {
    return { left, bottom: janela.altura - ancora.top + 6, largura, maxAltura: Math.max(ALTURA_MIN, espacoAcima - 6), lado: 'ACIMA' }
  }
  return { left, top: ancora.bottom + 6, largura, maxAltura: Math.max(ALTURA_MIN, espacoAbaixo - 6), lado: 'ABAIXO' }
}
