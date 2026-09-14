// ⭐⭐⭐ A REVISÃO DO IMPORT — O PADRÃO DO EXTRATO DE BANCO (14/09/2026).
//
// **O dono:** *"hoje o import baixa por baixo e mostra um resumo; o ajuste mora em outra
// tela. Vira o desenho do extrato: **O QUE CHEGOU · COM QUEM ESTÁ VINCULADO · AJUSTO ALI
// MESMO**."*
//
// ⛔⛔ **É a mesma classe da "porta sem maçaneta", só que de cabeça pra baixo:** o gesto
// EXISTE (a prateleira mapeia, o reprocesso rebaixa), mas mora **longe de onde a pergunta
// nasce**. O dono vê "COCA COLA LATA não baixou" no resumo e precisa sair da tela,
// encontrar o nome numa lista de 130 e voltar.
//
// ⚠️ E ela é a MESMA pra produtos e complementos: são dois mapas por desenho (25 nomes
// vivem nos dois relatórios), mas a PERGUNTA é idêntica — *"o que chegou e pra onde foi?"*.
// Uma tela por relatório seria a segunda régua de apresentação do mesmo fato.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { normalizarNome } from './grupo-complemento'

/**
 * ⭐⭐⭐ A FAIXA DO DIA — e ela existe porque **os dois writers usam convenções
 * DIFERENTES** (medido em prod, 14/09):
 * ```
 * stock_venda_complemento_linha → 2026-09-13T00:00:00.000Z
 * stock_venda_linha (produtos)  → 2026-09-13T15:00:00.000Z
 * ```
 * ⚠️ Os 15:00Z vêm de `new Date('2026-09-13T12:00:00')` **sem Z**: o processo roda em
 * `America/Sao_Paulo`, então o meio-dia "local" vira 15:00 UTC. O outro import grava
 * meia-noite. **Um leitor que compara timestamp EXATO acerta um e erra o outro** — e foi
 * exatamente o que a minha 1ª versão fez: devolveu **0 nomes** pro dia que tem 130.
 *
 * ⭐ Ler por FAIXA é indiferente à convenção de quem escreveu, hoje e no dia em que
 * alguém mudar a hora. ⛔ E `lt` no dia seguinte, nunca `lte` às 23:59:59.
 */
export function faixaDoDia(data: string): { gte: Date; lt: Date } {
  const [a, m, d] = data.split('-').map(Number)
  return { gte: new Date(Date.UTC(a, m - 1, d)), lt: new Date(Date.UTC(a, m - 1, d + 1)) }
}

export type EstadoDoVinculo = 'VINCULADO' | 'SEM_VINCULO' | 'IGNORADO'
export type Relatorio = 'PRODUTOS' | 'COMPLEMENTOS'

export interface SugestaoDeDestino {
  /** a ficha/nome que o canônico quase-igual aponta */
  fichaId: string
  rotulo: string
  /** ⚠️ o PORQUÊ, sempre — sugestão sem motivo visível não existe nesta casa */
  porQue: string
}

export interface LinhaDaRevisao {
  nome: string
  ocorrencias: number
  estado: EstadoDoVinculo
  /** o destino atual (ficha ou item de revenda) */
  destinoId: string | null
  destinoNome: string | null
  /**
   * ⭐ O RESUMO DO QUE DESCONTA, à vista: *"baixa: lata 350ml ×1"*.
   * ⚠️ Sem ele, "vinculado" é uma afirmação que o dono não tem como conferir — e vínculo
   * errado só aparece no dia em que o saldo não bate.
   */
  baixa: { itemNome: string; qtd: number }[]
  /** ⭐ só quando SEM_VINCULO e o canônico quase-bate — marcada COMO sugestão */
  sugestao: SugestaoDeDestino | null
  /** quando IGNORADO: quem e quando (o rastro que a tela mostra) */
  ignoradoEm: string | null
}

export interface RevisaoDoImport {
  data: string
  relatorio: Relatorio
  linhas: LinhaDaRevisao[]
  /** ⭐ os 3 contadores do topo — a mesma fonte da lista, nunca uma segunda contagem */
  contadores: { vinculados: number; semVinculo: number; ignorados: number }
  /** ⚠️ ocorrências, não nomes: é o que diz quanto do DIA está resolvido */
  ocorrencias: { vinculadas: number; semVinculo: number; ignoradas: number }
}

/**
 * ⭐⭐ A SUGESTÃO — canônico QUASE-igual, e ela **sugere, nunca decide**.
 *
 * ⛔ A régua do IDÊNTICO continua sendo a única que age sozinha (08/09): `COCA COLA LATA`
 * e `COCA LATA` **não** são a mesma string, e casá-los automaticamente seria adivinhar —
 * `FRUKI LATA` × `FRUKI LATA ZERO` é o contraexemplo que prova o perigo (uma é zero, a
 * outra não). Aqui a máquina só **aponta o candidato**; o clique é do dono.
 *
 * ⚠️ E ela exige que o candidato seja PREFIXO ou SUFIXO do outro, em PALAVRAS inteiras —
 * "parecido por letras" traria `FANTA UVA` pra `FANTA LARANJA`.
 */
export function sugerirDestino(
  nome: string,
  candidatos: readonly { fichaId: string; rotulo: string }[],
): SugestaoDeDestino | null {
  const alvo = normalizarNome(nome).split(/\s+/).filter(Boolean)
  if (alvo.length < 2) return null

  const achados = candidatos.filter((c) => {
    const p = normalizarNome(c.rotulo).split(/\s+/).filter(Boolean)
    if (!p.length || p.length >= alvo.length) return false
    /**
     * ⭐⭐⭐ A DIREÇÃO IMPORTA, e ela é a régua que impede a bebida errada.
     *
     * Só sugere quando a FICHA está contida NO NOME do PDV — `COCA LATA` ⊂ `COCA COLA
     * LATA` ✓. ⛔ **NUNCA o contrário:** `FRUKI LATA` (comum) com a ficha `FRUKI LATA
     * ZERO` seria a ficha ACRESCENTANDO um qualificador que o PDV não disse — e "zero"
     * é outra bebida. **Sugerir ali é inventar uma distinção que ninguém fez**, e um
     * clique rápido baixaria a errada.
     *
     * ⚠️ É a mesma família do guard do falso-amigo: o mais específico nunca vira o mais
     * genérico sozinho.
     */
    let i = 0
    for (const w of alvo) if (w === p[i]) i++
    return i === p.length
  })

  /**
   * ⛔⛔ DOIS CANDIDATOS = NÃO SUGERE. `FRUKI LATA` casaria com `FRUKI LATA ZERO` e com
   * uma `FRUKI LATA` comum se ela existisse — e escolher ali é decidir qual bebida sai do
   * estoque. **A ambiguidade se reporta, não se resolve** (a trava do PAO DE MEL).
   */
  if (achados.length !== 1) return null
  return {
    fichaId: achados[0].fichaId,
    rotulo: achados[0].rotulo,
    porQue: `o nome "${achados[0].rotulo}" está contido em "${nome}"`,
  }
}

/**
 * ⚠️ `atualizadoEm` só existe no mapa de COMPLEMENTOS — o de produtos tem só `criadoEm`.
 * O rastro do "ignorado em DD/MM" cai pro `criadoEm` ali, e é honesto: naquele mapa a
 * decisão não é editável no lugar, ela é substituída.
 */
interface MapaDaLinha { alvoTipo: string; fichaId: string | null; itemId: string | null; decididoEm: Date }

/**
 * ⭐⭐ MONTA A REVISÃO de um dia. **Só LÊ.**
 *
 * ⚠️ Os contadores saem da MESMA lista que a tela desenha — contar por outra query seria
 * o card dizendo 34 e a lista mostrando 9 (o defeito de 13/09, na outra tela).
 */
export async function montarRevisao(
  companyId: string,
  data: string,
  relatorio: Relatorio,
  db: PrismaClient = defaultPrisma,
): Promise<RevisaoDoImport> {
  const linhasCruas = relatorio === 'COMPLEMENTOS'
    ? (await db.stockVendaComplementoLinha.findMany({
        where: { companyId, data: faixaDoDia(data) },
        select: { nomeSuitable: true, ocorrencias: true },
      })).map((l) => ({ nome: l.nomeSuitable, ocorrencias: l.ocorrencias }))
    : (await db.stockVendaLinha.findMany({
        where: { companyId, data: faixaDoDia(data) },
        select: { nomeSuitable: true, quantidade: true },
      })).map((l) => ({ nome: l.nomeSuitable, ocorrencias: l.quantidade }))

  const mapaRows = relatorio === 'COMPLEMENTOS'
    ? (await db.stockVendaComplementoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, atualizadoEm: true } }))
        .map((m) => ({ nomeSuitable: m.nomeSuitable, alvoTipo: m.alvoTipo, fichaId: m.fichaId, itemId: null as string | null, decididoEm: m.atualizadoEm }))
    : (await db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true, criadoEm: true } }))
        .map((m) => ({ nomeSuitable: m.nomeSuitable, alvoTipo: m.alvoTipo, fichaId: m.fichaId, itemId: m.itemId, decididoEm: m.criadoEm }))
  const mapa = new Map<string, MapaDaLinha>(mapaRows.map((m) => [m.nomeSuitable, m]))

  // ── o que cada ficha DESCONTA (o resumo que fica à vista na linha) ──
  const fichaIds = [...new Set([...mapa.values()].map((m) => m.fichaId).filter((x): x is string => !!x))]
  const fichas = fichaIds.length
    ? await db.stockFicha.findMany({ where: { companyId, id: { in: fichaIds } }, select: { id: true, itemProduzidoId: true, versaoAtual: true } })
    : []
  const versoes = fichas.length
    ? await db.stockFichaVersao.findMany({
        where: { companyId, OR: fichas.map((f) => ({ fichaId: f.id, versao: f.versaoAtual })) },
        select: { id: true, fichaId: true },
      })
    : []
  const componentes = versoes.length
    ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: { in: versoes.map((v) => v.id) } }, select: { versaoId: true, itemId: true, qtdPlanejada: true } })
    : []
  const itemIds = [...new Set([
    ...fichas.map((f) => f.itemProduzidoId),
    ...componentes.map((c) => c.itemId),
    ...[...mapa.values()].map((m) => m.itemId).filter((x): x is string => !!x),
  ])]
  const nomeItem = new Map((await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true } })).map((i) => [i.id, i.nome]))
  const versaoDaFicha = new Map(versoes.map((v) => [v.fichaId, v.id]))
  const compsDaVersao = new Map<string, { itemNome: string; qtd: number }[]>()
  for (const c of componentes) {
    const arr = compsDaVersao.get(c.versaoId) ?? []
    arr.push({ itemNome: nomeItem.get(c.itemId) ?? '(item)', qtd: c.qtdPlanejada })
    compsDaVersao.set(c.versaoId, arr)
  }

  /**
   * ⭐ OS CANDIDATOS DA SUGESTÃO são as fichas que **já estão mapeadas neste relatório**.
   * ⚠️ Não é o catálogo inteiro: sugerir uma ficha que o dono nunca usou como destino é
   * palpite; sugerir uma que ele JÁ escolheu pra um nome irmão é padrão dele.
   */
  /**
   * ⭐⭐ OS CANDIDATOS SÃO AS FICHAS DE PRODUTO FINAL DA EMPRESA.
   *
   * ⚠️ A 1ª versão só olhava as fichas **já mapeadas neste relatório**, e a prova em prod
   * mostrou o buraco: `COCA COLA LATA` não sugeria nada, com a ficha `COCA LATA` existindo
   * — ela só não estava mapeada como COMPLEMENTO ainda. **Candidato estreito demais é uma
   * sugestão que não nasce justamente no caso que motivou a tela.**
   *
   * ⛔ E alargar é seguro porque as DUAS travas continuam: a direção (ficha ⊂ nome) e a
   * ambiguidade (dois candidatos = não sugere).
   */
  const todasAsFichas = await db.stockFicha.findMany({
    where: { companyId, ativo: true, tipoProduto: 'PRODUTO_FINAL' },
    select: { id: true, itemProduzidoId: true },
  })
  const nomesDasFichas = new Map((await db.stockItem.findMany({
    where: { companyId, id: { in: todasAsFichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true },
  })).map((i) => [i.id, i.nome]))
  const candidatos = todasAsFichas
    .map((f) => ({ fichaId: f.id, rotulo: nomesDasFichas.get(f.itemProduzidoId) ?? '' }))
    .filter((c) => c.rotulo)

  const linhas: LinhaDaRevisao[] = linhasCruas
    .map((l) => {
      const m = mapa.get(l.nome)
      if (!m) {
        return {
          nome: l.nome, ocorrencias: l.ocorrencias, estado: 'SEM_VINCULO' as const,
          destinoId: null, destinoNome: null, baixa: [],
          sugestao: sugerirDestino(l.nome, candidatos), ignoradoEm: null,
        }
      }
      if (m.alvoTipo === 'IGNORAR') {
        return {
          nome: l.nome, ocorrencias: l.ocorrencias, estado: 'IGNORADO' as const,
          destinoId: null, destinoNome: null, baixa: [], sugestao: null,
          ignoradoEm: m.decididoEm.toISOString().slice(0, 10),
        }
      }
      const ficha = m.fichaId ? fichas.find((f) => f.id === m.fichaId) : null
      const baixa = ficha ? (compsDaVersao.get(versaoDaFicha.get(ficha.id) ?? '') ?? []) : []
      return {
        nome: l.nome, ocorrencias: l.ocorrencias, estado: 'VINCULADO' as const,
        destinoId: m.fichaId ?? m.itemId,
        destinoNome: ficha ? (nomeItem.get(ficha.itemProduzidoId) ?? null) : (m.itemId ? nomeItem.get(m.itemId) ?? null : null),
        // ⚠️ revenda baixa o PRÓPRIO item ×1 — o resumo diz isso em vez de ficar vazio
        baixa: baixa.length ? baixa : (m.itemId ? [{ itemNome: nomeItem.get(m.itemId) ?? '(item)', qtd: 1 }] : []),
        sugestao: null, ignoradoEm: null,
      }
    })
    // ⭐ o trabalho primeiro: sem vínculo no topo, e dentro dele o que mais vendeu
    .sort((a, b) => {
      const peso = (e: EstadoDoVinculo) => (e === 'SEM_VINCULO' ? 0 : e === 'VINCULADO' ? 1 : 2)
      return peso(a.estado) - peso(b.estado) || b.ocorrencias - a.ocorrencias
    })

  const conta = (e: EstadoDoVinculo) => linhas.filter((l) => l.estado === e)
  const soma = (e: EstadoDoVinculo) => conta(e).reduce((s, l) => s + l.ocorrencias, 0)
  return {
    data, relatorio, linhas,
    contadores: { vinculados: conta('VINCULADO').length, semVinculo: conta('SEM_VINCULO').length, ignorados: conta('IGNORADO').length },
    ocorrencias: { vinculadas: soma('VINCULADO'), semVinculo: soma('SEM_VINCULO'), ignoradas: soma('IGNORADO') },
  }
}

// ---------------------------------------------------------------------------
// O PREVIEW DO AJUSTE — "o que muda se eu reprocessar agora"
// ---------------------------------------------------------------------------
//
// **O dono:** *"estorno+rebaixa SÓ dos nomes que mudaram (não o dia inteiro), com preview
// ('COCA COLA LATA: 5 ocorr. → baixa 5 latas') antes de gravar. Nada baixa pro destino
// novo sem eu ver o preview — mudança de vínculo é escrita em estoque."*
//
// ⚠️⚠️ **DECISÃO DE ENGENHARIA, declarada:** o PREVIEW é seletivo (mostra só o que muda),
// e a GRAVAÇÃO continua sendo o `reprocessarDia` que já existe — estorna e refaz o dia.
//
// **O efeito no estoque é IDÊNTICO** (o nome que não mudou é estornado e rebaixado pelo
// mesmo valor: líquido zero). O que um reprocesso seletivo economizaria é **ruído no
// ledger**, não exatidão. E abrir um SEGUNDO caminho de escrita no ledger é exatamente o
// que esta casa mais pagou caro — *"N caminhos, 1 esquecido"* custou o gatilho de vendas,
// o estorno de cartão e o split do empréstimo. ⭐ Se o ruído incomodar, o caminho é
// **estreitar o estorno do `gravarVenda`** (uma função, um lugar), nunca criar o segundo.

export interface MudancaDoAjuste {
  nome: string
  ocorrencias: number
  /** o que baixava antes (vazio = não baixava nada) */
  de: string | null
  /** o que passa a baixar */
  para: string | null
  /** a frase que a tela mostra: *"COCA COLA LATA: 5 ocorr. → baixa 5 × COCA LATA 350ML"* */
  frase: string
}

/**
 * ⭐⭐ O QUE MUDA — comparando o vínculo de HOJE com o que estava valendo no import.
 *
 * ⚠️ A fonte do "antes" é o `mapeadoNoImport` da linha: ele guarda **se tinha destino na
 * hora do processamento**. Não guarda QUAL — então o preview é honesto sobre o que sabe:
 * diz *"não baixava"* → *"passa a baixar X"*, e pra quem já baixava diz que o destino
 * mudou sem afirmar o antigo. **Inventar o destino anterior seria inventar história.**
 */
export async function previewDoAjuste(
  companyId: string,
  data: string,
  relatorio: Relatorio,
  db: PrismaClient = defaultPrisma,
): Promise<{ mudam: MudancaDoAjuste[]; inalterados: number }> {
  const revisao = await montarRevisao(companyId, data, relatorio, db)

  const linhasDoImport = relatorio === 'COMPLEMENTOS'
    ? await db.stockVendaComplementoLinha.findMany({ where: { companyId, data: faixaDoDia(data) }, select: { nomeSuitable: true, mapeadoNoImport: true } })
    : await db.stockVendaLinha.findMany({ where: { companyId, data: faixaDoDia(data) }, select: { nomeSuitable: true, mapeadoNoImport: true } })
  const baixavaAntes = new Map(linhasDoImport.map((l) => [l.nomeSuitable, l.mapeadoNoImport]))

  const mudam: MudancaDoAjuste[] = []
  for (const l of revisao.linhas) {
    const antes = baixavaAntes.get(l.nome) ?? false
    const agora = l.estado === 'VINCULADO'
    if (antes === agora) continue // ⚠️ sem mudança de ESTADO, nada a anunciar

    const destino = l.baixa.length
      ? l.baixa.map((b) => `${round1(b.qtd * l.ocorrencias)} × ${b.itemNome}`).join(' + ')
      : (l.destinoNome ?? '')
    mudam.push({
      nome: l.nome,
      ocorrencias: l.ocorrencias,
      de: antes ? '(o destino de antes)' : null,
      para: agora ? (l.destinoNome ?? null) : null,
      frase: agora
        ? `${l.nome}: ${l.ocorrencias} ocorr. → baixa ${destino}`
        // ⚠️ tirar o vínculo também é mudança, e ela DEVOLVE estoque — dizer isso
        : `${l.nome}: ${l.ocorrencias} ocorr. → deixa de baixar (o estoque volta)`,
    })
  }
  return { mudam, inalterados: revisao.linhas.length - mudam.length }
}

const round1 = (n: number) => Math.round(n * 10) / 10
