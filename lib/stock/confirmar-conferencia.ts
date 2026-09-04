// ESTOQUE FASE 1 item 2 — CONFIRMAR a conferência. O coração: transforma a nota + a
// conferência do funcionário em ESTOQUE de verdade. Numa transação:
//  (a) cadastra fornecedor + itens novos (nota a nota) + APRENDE o mapeamento cProd→item
//  (b) grava a conferência (item a item, divergência/motivo/foto)
//  (c) gera 1 movimento ENTRADA_NF por item (qtd RECEBIDA, custo convertido pelo fator)
//  (d) gera contas a pagar SUGERIDO das duplicatas (ponte OFF — não toca o financeiro)
//  (e) tira a nota da fila (status CONFIRMADA)
// Depois (fora da transação): recomputa saldo + envia Confirmação 210200 à SEFAZ.
// Isolado: só escreve stock_*. Idempotente: nota já confirmada não duplica.

import { prisma } from '@/lib/db'
import { normalizarBusca } from '@/lib/busca-texto'
import { criarMovimento } from './movement'
import { recomputeSaldoCache } from './saldo'
import { enviarEvento } from './sefaz/ciencia'
import { TP_EVENTO } from './sefaz/evento'
import { combinadoDaNota } from './ponte/combinado'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface ConfirmItemInput {
  nfeItemId: string
  cProd: string
  xProd: string
  uCom: string
  qtdNota: number
  vUnCom: number
  qtdRecebida: number
  motivo?: string | null
  fotoBase64?: string | null
  mapeado: { itemId: string; nome: string; unidadeControle: string; categoria?: string; fatorConversao: number; novo: boolean }
}
export interface ConfirmInput {
  companyId: string
  nfeId: string
  userId: string
  fornecedor: { cnpj: string; nome: string; uf?: string | null }
  itens: ConfirmItemInput[]
}
export interface ConfirmResult {
  conferenceId: string
  movimentos: number
  valorEntrada: number
  itensCadastrados: number
  payableSugeridas: number
  divergente: boolean
  sefaz: { ok: boolean; cStat: string; xMotivo: string; nProt?: string } | null
}

export async function confirmarConferencia(input: ConfirmInput): Promise<ConfirmResult> {
  const { companyId, nfeId, userId } = input

  const nfe = await prisma.stockNfe.findFirst({ where: { id: nfeId, companyId }, select: { id: true, chave: true, status: true, temXmlCompleto: true, vNF: true } })
  if (!nfe) throw new Error('Nota não encontrada.')
  // De onde veio o QUE está sendo conferido: XML da SEFAZ, ou os itens que o dono digitou
  // do DANFE de papel porque o XML não tinha chegado. Fica no ledger pra auditoria — é a
  // diferença entre "a SEFAZ me disse" e "eu li do papel".
  const origem = nfe.temXmlCompleto ? 'SEFAZ' : 'DANFE_MANUAL'
  const jaConf = await prisma.stockReceiptConference.findFirst({ where: { companyId, nfeId }, select: { id: true, status: true } })
  if (jaConf && jaConf.status !== 'EM_CONFERENCIA') throw new Error('Essa nota já foi conferida.')

  // ⭐ O COMBINADO manda, não a duplicata crua (29/08/2026 — caso BOX PAPER).
  // Se o dono já ajustou as parcelas antes de confirmar (o fornecedor cancelou os 3
  // boletos da nota e mandou 4), é o COMBINADO que vira sugestão de conta a pagar.
  // Sem renegociação, `combinadoDaNota` devolve as próprias duplicatas do XML — mesmo
  // resultado de antes. Resolvedor ÚNICO (REGRA 4): a tela e a gravação leem a mesma fonte.
  const combinado = await combinadoDaNota(companyId, nfeId, prisma)
  const dups = (combinado?.parcelas ?? []).map((p) => ({ nDup: p.numero, dVenc: p.dVenc, vDup: p.valor }))
  const divergente = input.itens.some((i) => i.motivo)
  let itensCadastrados = 0

  const conf = await prisma.$transaction(async (tx) => {
    // (a) fornecedor
    const cnpj = input.fornecedor.cnpj.replace(/\D/g, '')
    if (cnpj) {
      const existe = await tx.stockSupplier.findFirst({ where: { companyId, cnpj }, select: { id: true } })
      if (!existe) await tx.stockSupplier.create({ data: { companyId, cnpj, razaoSocial: input.fornecedor.nome, uf: input.fornecedor.uf ?? null, criadoVia: 'CONFERENCIA', criadoPorId: userId } })
    }

    // (a) itens novos + mapeamento aprendido
    const itemIdReal = new Map<string, string>() // nfeItemId → stock_item.id
    // ⭐⭐ PREVENÇÃO DO DUPLICADO (29/08/2026) — o caso das 2 BOBINAS.
    //
    // ⚠️ A MESMA nota trouxe o produto em DUAS linhas e cada uma criou seu item: dois
    // "BOBINA 02 LITROS 21X31CM LINHA LEVE 2.8", 0,93 e 0,926 UN. O `POST /itens` já
    // deduplicava por nome exato — mas a conferência **não passa por ele**, cria direto.
    // Agora um nome só vira UM item, mesmo repetido na nota (as duas linhas viram dois
    // MOVIMENTOS no mesmo item, que é o certo: o saldo soma).
    const criadosNestaNota = new Map<string, string>() // nome normalizado → itemId
    const chaveNome = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')
    for (const it of input.itens) {
      let itemId = it.mapeado.itemId
      if (it.mapeado.novo) {
        const k = chaveNome(it.mapeado.nome)
        const jaCriado = criadosNestaNota.get(k)
        // ⚠️ e confere também no CADASTRO: item com o mesmo nome que já existe no catálogo
        // é reusado em vez de duplicado (o dono pode ter criado antes, por outro caminho).
        const jaNoCatalogo = jaCriado
          ? null
          : await tx.stockItem.findFirst({ where: { companyId, nome: it.mapeado.nome.trim() }, select: { id: true } })
        if (jaCriado || jaNoCatalogo) {
          itemId = jaCriado ?? jaNoCatalogo!.id
        } else {
          const novo = await tx.stockItem.create({ data: { companyId, nome: it.mapeado.nome, unidadeControle: it.mapeado.unidadeControle, categoria: it.mapeado.categoria ?? 'USO_INTERNO', criadoVia: 'CONFERENCIA', criadoPorId: userId } })
          itemId = novo.id
          criadosNestaNota.set(k, novo.id)
          itensCadastrados++
        }
      }
      itemIdReal.set(it.nfeItemId, itemId)
      if (cnpj && it.cProd) {
        await tx.stockSupplierProduct.upsert({
          where: { companyId_supplierCnpj_cProd: { companyId, supplierCnpj: cnpj, cProd: it.cProd } },
          create: { companyId, supplierCnpj: cnpj, cProd: it.cProd, xProd: it.xProd, itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom },
          update: { itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom },
        })
      }

      // ⭐⭐ O MAPA POR NOME (31/08) — é o que faz o trabalho de digitar o DANFE valer pra
      // próxima nota. Sem isto o dono digitava os itens, mapeava um a um, e na nota
      // seguinte do MESMO fornecedor recomeçava do zero ("0/0 mapeados").
      //
      // ⚠️ GRAVA NOS DOIS CASOS, com a ORIGEM diferente: nota com XML aprende
      // `origem: 'CODIGO'` (o vínculo nasceu de um identificador do fornecedor); nota
      // digitada aprende `origem: 'NOME'` (nasceu de um texto que alguém leu no papel).
      // O dono pediu essa distinção pra poder AUDITAR depois — se um dia der problema, ele
      // precisa saber por qual das duas réguas aquele item foi casado.
      const nomeNorm = normalizarBusca(it.xProd ?? '')
      if (cnpj && nomeNorm) {
        await tx.stockSupplierProdutoNome.upsert({
          where: { companyId_supplierCnpj_xProdNormalizado: { companyId, supplierCnpj: cnpj, xProdNormalizado: nomeNorm } },
          create: {
            companyId, supplierCnpj: cnpj, xProd: it.xProd ?? '', xProdNormalizado: nomeNorm,
            itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom,
            origem: it.cProd ? 'CODIGO' : 'NOME', criadoPorId: userId ?? null,
          },
          update: { itemId, fatorConversao: it.mapeado.fatorConversao, unidadeNota: it.uCom },
        })
      }
    }

    // (b) conferência
    const conference = await tx.stockReceiptConference.create({
      data: { companyId, nfeId, chave: nfe.chave, status: divergente ? 'DIVERGENTE_ACEITA' : 'CONFIRMADA', conferidoPorId: userId, confirmadoPorId: userId, confirmadoEm: new Date() },
    })
    for (const it of input.itens) {
      await tx.stockConferenceItem.create({
        data: { companyId, conferenceId: conference.id, nfeItemId: it.nfeItemId, itemId: itemIdReal.get(it.nfeItemId), xProd: it.xProd, cProd: it.cProd || null, qtdNota: it.qtdNota, unidadeNota: it.uCom, qtdRecebida: it.qtdRecebida, divergencia: !!it.motivo, motivo: it.motivo ?? null, fotoBase64: it.fotoBase64 ?? null },
      })
    }

    // (c) movimentos ENTRADA_NF (qtd RECEBIDA; custo por unidade de controle = vUnCom/fator)
    let valorEntrada = 0
    for (const it of input.itens) {
      // ⚠️⚠️ CUSTO EM PRECISÃO CHEIA — arredondar AQUI perde dinheiro proporcional à
      // QUANTIDADE (29/08/2026). Caso real: BOX PAPER, 6.313 caixas de pizza. O custo
      // certo é 17.310,25 / 6.313 = 2,742145…; arredondado pra 2,74 e multiplicado dá
      // 17.297,62 — **R$ 12,63 a menos** do que a nota diz, num item só. A varredura
      // achou o mesmo padrão em 8 notas (SPAL, Menon, Dalmolin, Cancian: centavos).
      //
      // É a MESMA regra que o módulo já tinha aprendido duas vezes — na conclusão de
      // produção e na reunitização do pão (2,3125): **o ledger guarda precisão cheia;
      // quem arredonda é a LEITURA**. E não é só estética: com o fator certo,
      // qtdRecebida × (vUnCom/fator) == qCom × vUnCom == vProd **exato**, então o que
      // entra no estoque passa a bater ao centavo com o que a nota declara.
      const custoUnitario = it.vUnCom / (it.mapeado.fatorConversao || 1)
      const custoTotal = round2(it.qtdRecebida * custoUnitario)
      valorEntrada = round2(valorEntrada + custoTotal)
      await criarMovimento(tx, {
        companyId, itemId: itemIdReal.get(it.nfeItemId)!, tipo: 'ENTRADA_NF',
        quantidade: it.qtdRecebida, custoUnitario, custoTotal,
        receiptId: conference.id, nfeChave: nfe.chave, nItem: null, origem, criadoPorId: userId,
      })
    }

    // (d) contas a pagar SUGERIDO (ponte OFF)
    for (const d of dups) {
      await tx.stockPayableSuggestion.create({ data: { companyId, nfeId, chave: nfe.chave, supplierCnpj: cnpj || null, supplierNome: input.fornecedor.nome, nDup: d.nDup, dVenc: d.dVenc, valor: d.vDup } })
    }
    // ⭐⭐ NOTA SEM BOLETO TAMBÉM VIRA SUGESTÃO — com `dVenc = null` ("A DEFINIR").
    //
    // ⛔ MEDIDO EM PROD (03/09): **21 notas · R$ 8.588,75** passaram por aqui sem gerar
    // sugestão nenhuma, porque o laço acima roda sobre as DUPLICATAS e elas não têm. Pix e
    // dinheiro combinados com o fornecedor viravam dívida invisível: o dinheiro sai e nunca
    // aparece no fluxo de caixa. ⚠️ E o juiz também não via — o F3 vigia sugestão parada, e
    // sugestão que não nasce não pára (a cegueira do E15).
    if (!dups.length) {
      await tx.stockPayableSuggestion.create({
        data: {
          companyId, nfeId, chave: nfe.chave, supplierCnpj: cnpj || null,
          supplierNome: input.fornecedor.nome, nDup: null,
          dVenc: null, // ⚠️ NUNCA uma data inventada: sem documento, quem sabe é o dono
          valor: round2(nfe.vNF ?? 0),
        },
      })
    }

    // (e) tira da fila
    await tx.stockNfe.update({ where: { id: nfeId }, data: { status: 'CONFIRMADA' } })

    return { conferenceId: conference.id, valorEntrada, movimentos: input.itens.length, payableSugeridas: dups.length }
  })

  // fora da transação: saldo + Confirmação SEFAZ (falha não desfaz o recebimento físico)
  await recomputeSaldoCache(prisma, companyId)
  let sefaz: ConfirmResult['sefaz'] = null
  try {
    const r = await enviarEvento({ companyId, chave: nfe.chave, tpEvento: TP_EVENTO.CONFIRMACAO })
    sefaz = { ok: r.ok, cStat: r.cStat, xMotivo: r.xMotivo, nProt: r.nProt }
  } catch (e) {
    sefaz = { ok: false, cStat: 'ERRO', xMotivo: (e as Error).message }
  }

  return { ...conf, itensCadastrados, divergente, sefaz }
}
