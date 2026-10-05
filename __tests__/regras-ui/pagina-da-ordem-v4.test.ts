/**
 * ⭐⭐⭐ A PÁGINA DA ORDEM — VISUAL v4 (05/10/2026), mock aprovado no chat.
 *
 * **Ordem do dono, ao pé da letra:** *"(1) CABEÇALHO: «← voltar pra produção» + logo da receita
 * (o quadradinho 48px do mapa v4, mesma família/ícone da lista) + nome 19px peso 500 + sublinha
 * «N× a receita (vX) · data · setor» + à direita o PEDIDO em destaque (24px tabular; redondo
 * como no v4; derivado = «esperadas»). (2) TRILHO DE STATUS vira barra de progresso: 4
 * segmentos, pintados de índigo até o estado atual com ✓ nos passados, apagados nos futuros.
 * (3) INSUMOS — UMA COLUNA SÓ: «O que saiu da prateleira» + imprimir; À DIREITA UM número. As
 * colunas PLANEJADO × EM PRODUÇÃO morrem. O botão «devolver» SAI da tela — o código de
 * devolução pode continuar existindo por trás. Rodapé: «Custo em produção · R$ …». CONCLUÍDA:
 * o rótulo vira «consumido». (4) AÇÕES: «Iniciar produção» botão índigo forte; «Cancelar ordem»
 * discreto contorno. (5) ETAPAS viram linha do tempo: feita = check verde + pílula «feita ·
 * 9min» + mini-avatar + horários; a ATIVA = linha acesa índigo + relógio índigo + «no relógio»
 * AO VIVO; futura = apagada. (6) CONCLUÍDA: o cabeçalho ganha o par «pedido 305 · fez X» +
 * pílula «N% do pedido» (mesma lib da lista)."*
 *
 * ⚠️ **ESTRUTURAL e assumido como tal** (o projeto roda em `environment: node`, sem jsdom): o
 * que dá pra provar por COMPORTAMENTO mora nas libs (`trilho-da-ordem`, `pedido-na-tela`,
 * `cronometro`) e tem teste próprio. Aqui se trava a FORMA que o dono aprovou no mock — e,
 * principalmente, que a tela **não cria uma segunda régua** pro que já tem dono.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

/**
 * ⚠️⚠️ **LER SEM COMENTÁRIO É OBRIGATÓRIO AQUI, e por um motivo medido:** esta tela documenta
 * no próprio arquivo os defeitos que ela matou — *"as colunas PLANEJADO × EM PRODUÇÃO morrem"*
 * e *"a rota `devolver` segue viva"*. Lendo o texto cru, **o arquivo que documenta o defeito
 * seria o que o absolve** (a cicatriz da 5ª "menção, não uso" desta casa).
 */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'
const ETAPAS = 'components/estoque/etapas-da-ordem.tsx'
const ROTA_ACAO = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/acao/route.ts'
const ROTA_ETAPAS = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/etapas/route.ts'
const TRILHO = 'lib/stock/producao/trilho-da-ordem.ts'

const tela = () => semComentario(ler(ORDEM))
const etapas = () => semComentario(ler(ETAPAS))

/** conta USOS (ignora import e comentário) — a régua que a "menção, não uso" obriga */
const usosDe = (fonte: string, simbolo: string) =>
  semComentario(fonte)
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n')
    .split(simbolo).length - 1

// ───────────────────────── 1 + 6. o cabeçalho ─────────────────────────

describe('⭐⭐ 1. CABEÇALHO — logo 48 do dono único, nome 19px, pedido em destaque', () => {
  it('⛔⛔ o logo é o COMPONENTE ÚNICO, no tamanho 48 — não um 2º mapa de ícone', () => {
    const t = tela()
    expect(t, 'importa o logo único').toMatch(/from '@\/components\/estoque\/logo-da-receita'/)
    expect(t, 'no tamanho do cabeçalho').toMatch(/<LogoDaReceita[^>]*tamanho=\{48\}/)
    /**
     * ⛔ A tela NÃO pode traduzir `nome → ícone` por conta própria: duas traduções divergiriam
     * no 1º grupo novo do mapa, e a MESMA receita apareceria com caras diferentes em duas telas
     * — matando o reconhecimento, que é a razão de o logo existir.
     */
    expect(t, 'nenhum mapa de ícone na tela').not.toMatch(/Record<IconeDaReceita/)
    expect(t, 'nem a lib pura de cara direto').not.toMatch(/caraDaReceita\(/)
  })

  it('⭐ o nome é 19px e a sublinha diz escala · versão · data', () => {
    const t = tela()
    expect(t).toMatch(/text-\[19px\] font-medium/)
    expect(t).toMatch(/× a receita \(v\{ordem\.versaoFicha\}\)/)
  })

  it('⭐ o PEDIDO em 24px tabular, REDONDO pelo dono único', () => {
    const t = tela()
    expect(t, 'o destaque de 24px').toMatch(/text-\[24px\]/)
    expect(t, 'tabular (a classe `num` da casa)').toMatch(/num text-\[24px\]/)
    expect(t, 'redondo pelo `fmtPedido`').toMatch(/fmtPedido\(pedido\.unidades, ordem\.unidadeProduzido\)/)
    expect(t, 'e NUNCA um Math.round próprio').not.toMatch(/Math\.round\(pedido/)
  })

  /**
   * ⚠️⚠️ A PALAVRA MUDA COM A ORIGEM, e isso não é estilo: as 471 ordens que nasceram antes do
   * `stock_ordem_meta` não têm pedido DECLARADO. Chamar de *"pedidas"* um número que a ficha
   * calculou afirmaria uma decisão que ninguém tomou — é a mesma mentira do *"pedido 0"*.
   */
  it('⛔ derivado diz "esperadas", declarado diz "pedidas"', () => {
    expect(tela()).toMatch(/origem === 'DECLARADO' \? 'pedidas' : 'esperadas'/)
  })

  it('⭐⭐ 6. CONCLUÍDA: o par "fez N" + a pílula da MESMA lib da lista', () => {
    const t = tela()
    expect(t, 'a pílula vem do dono único').toMatch(/from '@\/lib\/stock\/producao\/pedido-na-tela'/)
    expect(t, 'e é chamada, não recalculada').toMatch(/pilulaDoPedido\(fez, pedido\.unidades, ordem\.unidadeProduzido\)/)
    expect(t, 'o par escreve a palavra "fez"').toMatch(/fez\s/)
    /** ⛔ a tela não refaz a divisão: um `fez / pedido` aqui seria a 2ª conta do mesmo número */
    expect(t, 'nenhum percentual calculado na tela').not.toMatch(/fez\s*\/\s*pedido/)
    /** ⚠️ soma as PARCIAIS: ordem pode fechar em dois dias */
    expect(t).toMatch(/conclusoes\.reduce\(\(t, c\) => t \+ c\.qtdGerada, 0\)/)
  })
})

// ───────────────────────── 2. a barra de progresso ─────────────────────────

describe('⭐⭐ 2. BARRA DE PROGRESSO — a decisão é da LIB, nunca do JSX', () => {
  it('⛔⛔ os 4 segmentos vêm de `trilhoDaOrdem`', () => {
    const t = tela()
    expect(t).toMatch(/from '@\/lib\/stock\/producao\/trilho-da-ordem'/)
    expect(t).toMatch(/trilhoDaOrdem\(ordem\.estado\)/)
    expect(t).toMatch(/trilho\.segmentos\.map/)
  })

  /**
   * ⛔⛔ **O JSX NÃO PODE DIGITAR OS RÓTULOS.** Se a tela escrever "Planejada/Separada/Em
   * produção/Concluída" na mão, o dia em que um estado entrar ou mudar de nome deixa a barra
   * dizendo uma coisa e a lib outra — e o CANCELADA, que é a borda real (a ordem SAI do
   * trilho), volta a depender de alguém lembrar.
   */
  it('⛔⛔ nenhum rótulo de passo escrito na tela', () => {
    const t = tela()
    for (const r of ['Planejada', 'Separada', 'Em produção', 'Concluída']) {
      expect(t, `"${r}" tem que vir do ROTULO_DO_PASSO`).not.toContain(`'${r}'`)
    }
    expect(semComentario(ler(TRILHO)), 'e a lib é quem os tem').toMatch(/ROTULO_DO_PASSO/)
  })

  it('⭐ ✓ só no PASSADO, e a barra fala com leitor de tela', () => {
    const t = tela()
    expect(t, 'o ✓ é condicionado ao feito').toMatch(/seg\.feito && <Check/)
    expect(t, 'nunca no atual (diria que acabou)').not.toMatch(/seg\.atual && <Check/)
    expect(t).toMatch(/role="progressbar"/)
    expect(t).toMatch(/aria-valuenow=\{trilho\.pintados\}/)
  })

  it('⛔ CANCELADA não desenha barra — e quem decide é a lib', () => {
    expect(tela(), 'a barra é gateada pelo `mostrar`').toMatch(/\{trilho\.mostrar && \(/)
    expect(semComentario(ler(TRILHO))).toMatch(/mostrar: false/)
  })
})

// ───────────────────────── 3. insumos: uma coluna ─────────────────────────

describe('⭐⭐⭐ 3. INSUMOS — UMA COLUNA SÓ, e o "devolver" sai da TELA', () => {
  it('⭐ o cartão diz o FATO ("saiu da prateleira") e tem imprimir', () => {
    const t = tela()
    expect(t).toContain('O que saiu da prateleira')
    expect(t, 'imprimir pra levar pra câmara').toMatch(/window\.print\(\)/)
  })

  /**
   * ⛔⛔ **AS DUAS COLUNAS ERAM O MESMO NÚMERO** (`qtdSeparada` e "em produção" só divergem
   * quando há devolução, e a decisão do dono é *"nunca devolvem"*). Duas colunas iguais fazem
   * o olho procurar a diferença que não existe.
   */
  it('⛔⛔ as colunas PLANEJADO × EM PRODUÇÃO morreram', () => {
    const t = tela()
    expect(t).not.toContain('PLANEJADO')
    expect(t).not.toContain('EM PRODUÇÃO')
  })

  it('⭐ CONCLUÍDA: o rótulo do número vira "consumido"', () => {
    expect(tela()).toMatch(/'consumido ' : 'separado '/)
  })

  it('⭐ o rodapé diz o custo pelo formatador da casa', () => {
    const t = tela()
    expect(t).toMatch(/Custo \{planejada \? 'a separar' : ordem\.estado === 'CONCLUIDA' \? 'consumido' : 'em produção'\}/)
    expect(t, 'R$ pelo dono único').toMatch(/formatBRL\(custoSeparado\)/)
  })

  /**
   * ⭐⭐ **A TELA PARA DE OFERECER; A CAPACIDADE FICA.** *"Botão morto = clique errado
   * esperando"* — mas apagar o caminho de devolução quebraria o invariante **P1** (`Σ separado
   * == Σ consumido + Σ devolvido`), que é o que prova que nada evapora entre a câmara e a
   * panela. Guard de dois lados: fora da tela **E** vivo na rota.
   */
  it('⛔⛔ "devolver" não é oferecido na TELA — e a rota continua aceitando', () => {
    const t = tela()
    expect(t, 'nenhum gesto de devolver na tela').not.toMatch(/acao: 'devolver'/)
    expect(t, 'nem o ícone dele').not.toMatch(/Undo2/)
    expect(t, 'nem estado de devolução').not.toMatch(/setDevolver/)
    const rota = semComentario(ler(ROTA_ACAO))
    expect(rota, 'a CAPACIDADE fica (P1 depende dela)').toMatch(/'devolver'/)
    expect(rota, 'e o caso segue implementado').toMatch(/case 'devolver'/)
  })
})

// ───────────────────────── 4. as ações ─────────────────────────

describe('⭐⭐ 4. AÇÕES — um primário índigo, cancelar de contorno', () => {
  it('⭐ a principal muda com o estado, e usa o token de ação da casa', () => {
    const t = tela()
    expect(t, 'planejada → confirmar separação').toMatch(/onClick=\{confirmarSeparacao\}/)
    expect(t, 'separada → iniciar').toMatch(/acao: 'iniciar'/)
    expect(t, 'em produção → a âncora do formulário').toMatch(/href="#concluir"/)
    expect(t, 'índigo pelo token, nunca hex').toMatch(/var\(--prod-acao-bg\)/)
  })

  /**
   * ⛔ **CANCELAR É CONTORNO, NUNCA PREENCHIDO.** Dois botões fortes competindo fazem a ação
   * principal deixar de ser óbvia — a mesma régua do *"um primário só"* da home.
   */
  it('⛔ o cancelar não usa o fundo de ação', () => {
    const t = tela()
    const i = t.indexOf('Cancelar ordem')
    expect(i, 'o botão existe').toBeGreaterThan(0)
    // o bloco do próprio botão (do `<button` anterior até o rótulo)
    const bloco = t.slice(t.lastIndexOf('<button', i), i)
    expect(bloco, 'cancelar é contorno').toMatch(/borderColor: 'var\(--prod-line-strong\)'/)
    expect(bloco, 'e NUNCA primário').not.toMatch(/--prod-acao-bg/)
  })

  it('⛔ ordem encerrada não oferece ação nenhuma', () => {
    expect(tela()).toMatch(/\{!encerrada && \(/)
  })
})

// ───────────────────────── 5. etapas: linha do tempo ─────────────────────────

describe('⭐⭐⭐ 5. ETAPAS — linha do tempo, com o cronômetro VIVO da casa', () => {
  it('⭐ a pílula da feita diz O QUE e QUANTO, com mini-avatar', () => {
    const e = etapas()
    expect(e, 'a pílula "feita · 9min"').toMatch(/feita · <span className="tabular-nums">\{duracao\(e\.minutos\)\}/)
    expect(e, 'o avatar vem do componente único').toMatch(/from '@\/components\/estoque\/avatar-pessoa'/)
    expect(usosDe(e, '<AvatarPessoa'), 'usado nas linhas, não só importado').toBeGreaterThanOrEqual(3)
    expect(e, 'e os horários ficam').toMatch(/\{hhmm\(e\.iniciadoEm\)\}–\{hhmm\(e\.finalizadoEm\)\}/)
  })

  /**
   * ⛔⛔ **O TEXTO DO RELÓGIO TEM UM DONO SÓ.** `textoDoCronometro` é a régua desta casa
   * (`mm:ss` abaixo de 1h, `h:mm` acima) e é a MESMA que o *"HOJE ao vivo"* usa. Formatar aqui
   * faria o mesmo lote mostrar dois tempos em duas telas — e foi exatamente por a conta morar
   * na tela que o cronômetro do tablet passou dois dias mentindo zero (08/09).
   */
  it('⛔⛔ o cronômetro vivo vem da lib, e a tela não formata relógio', () => {
    const e = etapas()
    expect(e).toMatch(/from '@\/lib\/stock\/producao\/cronometro'/)
    expect(e).toMatch(/textoDoCronometro\(e\.iniciadoEm, Date\.now\(\) \+ desvioRef\.current\)/)
    expect(e, 'nenhuma formatação de relógio na mão').not.toMatch(/padStart\(2, '0'\)/)
    expect(e, 'nem divisão por 3600 na tela').not.toMatch(/\/ 3600/)
  })

  /**
   * ⛔⛔ **O DESVIO É MEDIDO, NUNCA SUPOSTO.** Relógio de aparelho pode estar torto, e
   * `Math.max(0, …)` sobre um tablet atrasado **para** o cronômetro em 00:00 em vez de acusar.
   * A cura da casa é medir contra o servidor — e pra isso o servidor tem que DIZER a hora dele
   * nos TRÊS caminhos (GET, PATCH, POST): um deles esquecer faria o cronômetro voltar a
   * confiar no aparelho **só depois de um gesto**.
   */
  it('⛔⛔ o desvio do aparelho é medido contra o servidor, nos 3 caminhos', () => {
    const e = etapas()
    expect(e).toMatch(/desvioDoAparelho\(j\.agoraServidor\)/)
    expect(usosDe(e, 'desvioDoAparelho('), 'remedido a cada resposta').toBeGreaterThanOrEqual(3)
    const rota = semComentario(ler(ROTA_ETAPAS))
    expect(rota, 'o servidor diz que hora é lá').toMatch(/agoraServidor: agora\.toISOString\(\)/)
    expect(usosDe(rota, 'responder(companyId, ordemId)'), 'GET + PATCH + POST').toBe(3)
  })

  it('⭐ a ATIVA acende em índigo; a FUTURA apaga', () => {
    const e = etapas()
    expect(e, 'a fase sai do estado do SERVIDOR').toMatch(/e\.estado === 'EM_ANDAMENTO'\) return 'AGORA'/)
    expect(e, 'e a ativa é a única com fundo').toMatch(/fase === 'AGORA' \? 'var\(--fam-indigo-bg\)' : undefined/)
    expect(e, 'o relógio da ativa é índigo').toMatch(/color: 'var\(--fam-indigo-mid\)'/)
  })

  /**
   * ⭐ O TRILHO é o que separa esta tela de uma lista: o fio liga as etapas no eixo do tempo.
   * ⚠️ E ele NÃO desce depois da última — fio terminando no vazio promete uma etapa que não
   * existe.
   */
  it('⭐ o fio do trilho existe e para na última etapa', () => {
    expect(etapas()).toMatch(/\{!ultima && \(/)
  })

  it('⛔ os gestos do gerente e a designação CONTINUAM vivos', () => {
    const e = etapas()
    expect(e, 'pedir pra finalizar').toContain('pedir pra finalizar')
    expect(e, 'finalizar por ela').toContain('finalizar por ela')
    expect(e, 'designar a dupla').toMatch(/designar\(e\.id, \[/)
    expect(e, 'o plano da etapa').toMatch(/plano\(e\.id, \{ diaPrevisto/)
    expect(e, 'e liberar pra equipe').toContain('liberar pra equipe')
  })

  /**
   * ⚠️ O INTERVALO SÓ EXISTE COM ETAPA ATIVA — ordem concluída não gasta um timer por segundo
   * pra sempre (a régua do auto-refresh do "HOJE ao vivo": *recarregar o passado é gastar
   * requisição num dia que não muda*).
   */
  it('⚠️ o timer de 1s só liga quando há etapa em andamento', () => {
    const e = etapas()
    expect(e).toMatch(/if \(!temAtiva\) return/)
    expect(e).toMatch(/setInterval\(/)
    expect(e, 'e é desmontado').toMatch(/clearInterval\(/)
  })
})

// ───────────────────── 2 viewports e 2 temas ─────────────────────

describe('⭐⭐ REGRA 12 + 2 TEMAS — uma composição, zero cor cravada', () => {
  /**
   * ⛔⛔ **UMA COMPOSIÇÃO, NÃO UMA POR VIEWPORT.** Dois blocos (um `sm:hidden`, outro
   * `hidden sm:`) desenhando o mesmo dado divergem no primeiro campo novo — e o celular, que é
   * onde o dono opera, é justamente a metade que alguém esquece de atualizar (o fix pela metade
   * de 16/09).
   */
  it('⛔⛔ nenhum par de blocos por viewport', () => {
    for (const [nome, fonte] of [['a ordem', tela()], ['as etapas', etapas()]] as const) {
      expect(fonte, `${nome}: sem bloco só-celular`).not.toMatch(/className="[^"]*\bsm:hidden\b/)
      expect(fonte, `${nome}: sem bloco só-desktop`).not.toMatch(/className="[^"]*\bhidden (sm|lg):(block|flex)\b/)
    }
  })

  /**
   * ⚠️ **A 1ª versão desta asserção contava `linhas.map(` e era INGÊNUA** — a tela mapeia as
   * linhas pra CINCO perguntas diferentes (a lista, o desencontro de separação, a previsão, a
   * conclusão, o payload do consumo). O que prova "uma composição" é a LISTA ter um `<ul>` só
   * dentro do cartão de insumos; o resto não é vitrine.
   */
  it('⭐ o cartão de insumos tem UMA lista, e ela quebra com flex-wrap', () => {
    const t = tela()
    const card = t.slice(t.indexOf('O que saiu da prateleira'), t.indexOf("Custo {planejada"))
    expect(card.length, 'o cartão foi achado').toBeGreaterThan(200)
    expect(usosDe(card, '<ul'), 'uma lista, não uma por viewport').toBe(1)
    expect(card, 'e a linha quebra em vez de duplicar o bloco').toMatch(/flex-wrap/)
  })

  /**
   * ⛔⛔ **2 TEMAS SE PROVAM POR TOKEN.** A cor cravada (`slate-500`, `#185FA5`) não inverte no
   * escuro — e a prova de tema desta casa é *"zero hex cravado + o token existe nos dois mapas
   * do CSS"*. Classe de paleta fixa aqui é a dívida do dark mode voltando pela porta de uma
   * tela nova.
   */
  it('⛔⛔ zero paleta cravada na ordem e nas etapas', () => {
    for (const [nome, fonte] of [['a ordem', tela()], ['as etapas', etapas()]] as const) {
      for (const fam of ['slate', 'amber', 'emerald', 'rose', 'sky', 'zinc', 'gray']) {
        expect(fonte, `${nome}: ${fam}-N não inverte no escuro`).not.toMatch(
          new RegExp(`\\b(text|bg|border|divide|ring)-${fam}-\\d`),
        )
      }
      expect(fonte, `${nome}: sem hex de cor`).not.toMatch(/(color|background|borderColor): '#[0-9a-fA-F]{3,8}'/)
      expect(fonte, `${nome}: sem hex em classe`).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/)
    }
  })

  /**
   * ⚠️ E opacidade sobre valor arbitrário (`bg-[var(--x)]/70`) **não gera cor no Tailwind 3** —
   * sai transparente. Achado nesta volta, convertendo a tela: o aviso de eficiência ficaria sem
   * fundo nenhum.
   */
  it('⚠️ nenhum sufixo de opacidade sobre token', () => {
    expect(tela()).not.toMatch(/\[var\(--[a-z-]+\)\]\/\d/)
  })
})
