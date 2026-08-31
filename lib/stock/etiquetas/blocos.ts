// ⭐⭐ O MODELO DE ETIQUETA EM BLOCOS (30/08/2026) — o dono DESENHA, não só configura.
//
// ⚠️ POR QUE TROQUEI COORDENADA FIXA POR FLUXO DE BLOCOS: "arrastar pra reordenar" e
// "adicionar linha de texto livre" são impossíveis com x/y cravados — mover um campo
// exigiria recalcular o y de todos os outros na mão, e uma linha nova empurraria tudo.
// Com FLUXO, a ordem da lista É o layout: o y de cada bloco sai do empilhamento. O dono
// arrasta; o sistema calcula.
//
// ⭐ E A FONTE CONTINUA ÚNICA: `blocosParaLayout` transforma a lista em posições, e tanto
// o ZPL quanto a prévia consomem ESSA saída. Prévia do editor == prévia da tela de
// imprimir == o que sai da Zebra, nos três lugares, porque os três chamam a mesma função.

import type { CampoId, DadosEtiqueta } from './modelo'
import { LADO_DOTS, valoresDaEtiqueta } from './modelo'

export type TipoBloco = 'campo' | 'texto' | 'qr'

export interface Bloco {
  /** identidade estável (o React precisa, e o arrastar também) */
  id: string
  tipo: TipoBloco
  /** qual campo do sistema (tipo 'campo') */
  campo?: CampoId
  /** conteúdo fixo (tipo 'texto') — "Mantenha congelado", CNPJ, telefone… */
  texto?: string
  /** rótulo que o DONO escreve: "FAB", "FABRICAÇÃO", "MANIP." ou vazio */
  rotulo: string
  /** altura da fonte em dots (a etiqueta tem 480 de lado) */
  fonte: number
  negrito?: boolean
  /** vídeo invertido — a linha que tem que ser lida de longe */
  destaque?: boolean
  ativo: boolean
  /** só QR: magnificação (1..10) */
  qrTamanho?: number
}

export const MARGEM = 18
/** respiro entre blocos, em dots */
export const ESPACO = 12

/**
 * ⭐ Quanta ALTURA o fluxo de texto tem de verdade.
 *
 * ⚠️ É derivado do MESMO limite que decide o `estourou` (`y > LADO_DOTS`, com `y`
 * começando na margem e cada bloco somando `altura + ESPACO`). Se a barra "espaço usado"
 * da tela tivesse um denominador próprio, ela mostraria 92% numa etiqueta que já
 * estourou — dois números para a mesma pergunta, que é a doença que este módulo mais paga.
 */
export const LADO_DOTS_USAVEL = LADO_DOTS - MARGEM - ESPACO

/** ⭐ o modelo que toda empresa começa — a ordem é a da leitura da cozinha:
 *  o que é → quando vence → o resto. */
export const BLOCOS_PADRAO: Bloco[] = [
  { id: 'produto', tipo: 'campo', campo: 'produto', rotulo: '', fonte: 40, negrito: true, ativo: true },
  { id: 'validade', tipo: 'campo', campo: 'validade', rotulo: 'VAL', fonte: 44, destaque: true, ativo: true },
  { id: 'estado', tipo: 'campo', campo: 'estado', rotulo: '', fonte: 24, ativo: true },
  { id: 'fabricacao', tipo: 'campo', campo: 'fabricacao', rotulo: 'FAB', fonte: 24, ativo: true },
  { id: 'quantidade', tipo: 'campo', campo: 'quantidade', rotulo: '', fonte: 24, ativo: true },
  { id: 'lote', tipo: 'campo', campo: 'lote', rotulo: 'LOTE', fonte: 24, ativo: true },
  { id: 'colaborador', tipo: 'campo', campo: 'colaborador', rotulo: '', fonte: 22, ativo: true },
  { id: 'empresa', tipo: 'campo', campo: 'empresa', rotulo: '', fonte: 20, ativo: true },
  { id: 'qr', tipo: 'qr', rotulo: '', fonte: 0, qrTamanho: 5, ativo: true },
]

export const novoBlocoTexto = (texto = 'Texto novo'): Bloco => ({
  id: `texto-${Math.random().toString(36).slice(2, 9)}`,
  tipo: 'texto', texto, rotulo: '', fonte: 22, ativo: true,
})

// ---------------------------------------------------------------------------
// ⭐⭐ A REGRA DO SEPARADOR — UMA SÓ, E ELA NÃO MORA NO DADO (31/08/2026)
// ---------------------------------------------------------------------------
//
// ⛔ O QUE ACONTECIA: o layout fazia `${rotulo}${valor}` e o separador estava EMBUTIDO
// NO DADO, campo a campo — `BLOCOS_PADRAO` gravava `'VAL '`, `'FAB '`, `'LOTE '` **com
// espaço no fim** e o produto gravava `''`. Não era uma regra, era um hábito de digitação.
// Resultado medido em prod: o dono escreveu "queijo" no rótulo do nome do produto e a
// prévia mostrou **"queijoPorção de carne 100g"**, enquanto a validade saía "VAL 03/09"
// certinha. Dois campos, dois comportamentos, nenhuma regra.
//
// ⭐ AGORA O RÓTULO GUARDA SÓ O TEXTO e quem junta é esta função. Isso resolve os três de
// uma vez: o grudado, o inconsistente e o espaço sobrando quando o rótulo é vazio.
//
// ⚠️ E ELA NORMALIZA O QUE JÁ ESTÁ NO BANCO: os modelos salvos têm `'VAL '` com o espaço.
// Sem o `trim` viraria "VAL  03/09" (dois espaços) — o bug trocaria de cara em vez de
// sumir. Por isso a normalização é na LEITURA e não numa migration: modelo salvo continua
// válido, e quem grava daqui pra frente grava limpo.

export function juntarRotuloValor(rotulo: string | null | undefined, valor: string): string {
  const r = (rotulo ?? '').trim()
  const v = (valor ?? '').trim()
  if (!r) return v   // ⭐ rótulo vazio é estado VÁLIDO — e não deixa espaço na frente
  if (!v) return r   // ⭐⭐ RÓTULO SOZINHO SAI (ver o bloco abaixo)
  return `${r} ${v}`
}

// ⛔⛔ "RÓTULO SOZINHO NÃO VIRA LINHA" ERA REGRA ERRADA — caso real de 31/08/2026.
//
// O dono pôs o rótulo **"carne 100 grama"** no Nome do produto e deixou o conteúdo de
// prévia vazio: a linha SUMIU inteira. Bastava digitar uma letra pra ela voltar.
// Isso quebra a promessa que a própria tela faz — a caixa azul do inspetor diz
// **"SAI EM TODA ETIQUETA — É SALVO"**, e não saía.
//
// ⚠️ O RÓTULO É CONTEÚDO DO MODELO, não enfeite de um valor variável. Quem escreve
// "carne 100 grama" ali está usando o rótulo como TEXTO FIXO da etiqueta, e essa é uma
// decisão do dono como qualquer outra deste módulo.
//
// ⚠️⚠️ E A REGRA VELHA GUARDAVA UM ESTADO QUE NÃO EXISTE: ela nasceu pra evitar imprimir
// "VAL" solto sem data — mas `valoresDaEtiqueta` devolve **"A DEFINIR"** quando não há
// validade, nunca string vazia. **Eram duas réguas pro mesmo caso**, e a segunda cobrava
// um preço real (o bug acima) por um problema que a primeira já resolvia. Campos que
// PODEM vir vazios são produto, quantidade, lote, colaborador e empresa — em nenhum deles
// existe um "rótulo solto perigoso": ou o dono escreveu o rótulo de propósito, ou não
// escreveu nenhum e a linha some sozinha.
//
// A REGRA ÚNICA passou a ser: **a linha existe se há algo pra imprimir** — rótulo OU
// conteúdo. Vazio nos dois = nada a desenhar, e aí a linha some mesmo (linha em branco
// vira buraco no meio da etiqueta).

// ---------------------------------------------------------------------------
// ⚠️ CABE NA LARGURA? — ESTIMATIVA DECLARADA, NUNCA UMA AFIRMAÇÃO
// ---------------------------------------------------------------------------
//
// ⛔ O PROBLEMA REAL: o ZPL usa `^FD` com `^A0N` e **sem `^FB`** — ou seja, a Zebra NÃO
// quebra linha: ela CORTA no fim da etiqueta. Hoje a prévia falha de três jeitos
// diferentes do que a impressora faz (linha normal VAZA pra fora da borda; linha em
// destaque corta com "…"; a Zebra corta seco nos 480 dots). Com dado de exemplo curto
// ninguém via; com nome de produto real, some texto sem ninguém saber.
//
// ⚠️⚠️ A MEDIDA **NÃO** PODE VIR DO NAVEGADOR, e a razão é a regra dos alarmes deste
// sistema: fonte de tela e fonte de impressora têm métricas diferentes, então um aviso
// tirado de `canvas.measureText` erraria nos DOIS sentidos — avisaria em nome que cabe e
// deixaria passar nome que corta. Alarme falso repetido é como um alarme morre.
//
// ⚠️ POR ISSO ESTA CONSTANTE ESTÁ MARCADA COMO **NÃO MEDIDA**. A fonte 0 do ZPL é
// proporcional e a razão largura/altura real só se sabe imprimindo. Enquanto ela não for
// calibrada contra a Zebra física, o aviso diz **"pode cortar"** e nunca "vai cortar" —
// a apurar é melhor que número inventado com cara de fato.
//
// COMO CALIBRAR (o dono tem a impressora): imprimir a régua abaixo e ver em qual coluna
// o texto some. `LARGURA_POR_ALTURA = (nº de caracteres que couberam) ↦ 460 / (n × 24)`.
//   ^XA^CI28^PW480^LL480
//   ^FO10,40^A0N,24,24^FD00000000010000000002000000000300000000^FS
//   ^FO10,100^A0N,40,40^FDMMMMMMMMMMMMMMMMMMMM^FS
//   ^FO10,160^A0N,40,40^FDiiiiiiiiiiiiiiiiiiii^FS
//   ^XZ
// (os "M" e os "i" dão o pior e o melhor caso — a razão real fica no meio)

/** ⚠️ NÃO MEDIDO — ver o bloco acima. Trocar por medida real calibra o aviso. */
export const LARGURA_POR_ALTURA = 0.55
export const LARGURA_CALIBRADA = false

/** largura ESTIMADA do texto em dots, pela métrica da fonte ZPL (nunca a do navegador) */
export function larguraEstimadaDots(texto: string, fonte: number): number {
  return texto.length * fonte * LARGURA_POR_ALTURA
}

// ---------------------------------------------------------------------------
// O LAYOUT CALCULADO — a fonte única
// ---------------------------------------------------------------------------

export interface BlocoPosicionado {
  bloco: Bloco
  /** texto final já com rótulo (vazio = não desenha) */
  valor: string
  /** ⭐ as DUAS PARTES, separadas — é o que deixa a etiqueta ser clicável por parte
   *  ("VAL" leva ao rótulo, "03/09/2026" leva ao dado de exemplo). O texto desenhado
   *  continua sendo `valor`; estas são a mesma coisa, antes de juntar. */
  partes: { rotulo: string; conteudo: string }
  x: number
  y: number
  /** altura ocupada em dots */
  altura: number
  /** quanto sobra de largura nesta linha (já descontando o QR, quando ele estorva) */
  larguraDisponivel: number
  /** ⚠️ ESTIMATIVA (ver LARGURA_CALIBRADA) — a Zebra corta, não quebra linha */
  podeCortar: boolean
}

export interface LayoutCalculado {
  blocos: BlocoPosicionado[]
  /** altura usada pelo fluxo de texto */
  alturaUsada: number
  /** ⚠️ passou dos 480 dots — não cabe na etiqueta */
  estourou: boolean
  /** ⚠️ alguma linha pode sair cortada na largura (estimativa) */
  podeCortar: boolean
  qr: BlocoPosicionado | null
}

/**
 * Empilha os blocos ATIVOS de cima pra baixo e devolve as posições.
 *
 * ⚠️ O QR NÃO ENTRA NO FLUXO: ele é ancorado no canto inferior direito. Se entrasse,
 * comeria ~105 dots de altura (de 480) e empurraria o resto pra fora — a etiqueta é
 * pequena e o QR é quadrado. A tela diz isso pro dono, pra ele não achar que arrastar o
 * QR muda a posição dele.
 */
export function blocosParaLayout(blocos: Bloco[], dados: DadosEtiqueta): LayoutCalculado {
  const valores = valoresDaEtiqueta(dados)
  const out: BlocoPosicionado[] = []
  let y = MARGEM
  let qr: BlocoPosicionado | null = null

  // 1ª passada: o QR primeiro, porque ele é âncora e as linhas de baixo disputam largura
  // com ele. Sem isto, a última linha ("Caçula Mix") "caberia" por cima do QR.
  for (const b of blocos) {
    if (!b.ativo || b.tipo !== 'qr') continue
    const lado = (b.qrTamanho ?? 5) * 21
    qr = {
      bloco: b, valor: valores.qr,
      x: LADO_DOTS - lado - MARGEM, y: LADO_DOTS - lado - MARGEM, altura: lado,
      partes: { rotulo: '', conteudo: valores.qr },
      larguraDisponivel: lado, podeCortar: false,
    }
  }

  for (const b of blocos) {
    if (!b.ativo || b.tipo === 'qr') continue
    const bruto = b.tipo === 'texto' ? (b.texto ?? '') : (valores[b.campo as CampoId] ?? '')
    // ⭐ o separador sai de UMA função (ver o bloco no topo), nunca de espaço no dado
    const valor = juntarRotuloValor(b.rotulo, bruto)
    // ⚠️⚠️ UM GUARD SÓ, e ele olha o que VAI SER DESENHADO (31/08). Antes eram dois: este
    // e um `if (!bruto.trim()) continue` duas linhas acima, que matava a linha ANTES de o
    // rótulo ser considerado — era ELE que sumia com o "carne 100 grama". Guard que decide
    // por uma das partes não pode existir num lugar onde a linha é a soma das duas.
    if (!valor) continue
    const altura = b.destaque ? b.fonte + 14 : b.fonte

    // largura útil: até a margem direita — a não ser que o QR ocupe a mesma faixa de altura
    const estorvaQr = qr != null && y + altura > qr.y
    const limiteDireito = estorvaQr ? (qr as BlocoPosicionado).x - ESPACO : LADO_DOTS - MARGEM
    const larguraDisponivel = Math.max(0, limiteDireito - MARGEM)

    out.push({
      bloco: b, valor, partes: { rotulo: (b.rotulo ?? '').trim(), conteudo: bruto },
      x: MARGEM, y, altura, larguraDisponivel,
      podeCortar: larguraEstimadaDots(valor, b.fonte) > larguraDisponivel,
    })
    y += altura + ESPACO
  }

  return {
    blocos: out,
    alturaUsada: y - ESPACO - MARGEM,
    estourou: y > LADO_DOTS,
    podeCortar: out.some((p) => p.podeCortar),
    qr,
  }
}

// ---------------------------------------------------------------------------
// ⭐ REORDENAR — UMA FUNÇÃO, DOIS GESTOS (31/08/2026)
// ---------------------------------------------------------------------------
//
// ⚠️ REGRA DO DONO: arrastar e as setas ↑↓ existem nos DOIS (desktop e celular) e mexem
// na MESMA lista. Ter arrastar só no desktop e setas só no celular seria dois
// comportamentos pra uma decisão — o "N caminhos, 1 esquecido" que já mordeu este
// sistema mais de cinco vezes. Aqui os dois gestos chamam ESTA função; o teclado ganha
// de brinde (as setas são botões de verdade).

export function moverBloco(blocos: Bloco[], de: number, para: number): Bloco[] {
  if (de === para) return blocos
  if (de < 0 || de >= blocos.length) return blocos
  // ⚠️ fora da lista não move — arrastar pra fora da área é gesto de desistência,
  // não de "põe no fim". Silenciosamente ignorar é o certo aqui.
  if (para < 0 || para >= blocos.length) return blocos
  const copia = [...blocos]
  const [movido] = copia.splice(de, 1)
  copia.splice(para, 0, movido)
  return copia
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 1 — ZPL
// ---------------------------------------------------------------------------

const zplSafe = (s: string) => s.replace(/[\^~]/g, ' ')

export function zplDosBlocos(blocos: Bloco[], dados: DadosEtiqueta): string {
  const l = blocosParaLayout(blocos, dados)
  const linhas: string[] = []
  for (const p of l.blocos) {
    const texto = zplSafe(p.valor)
    if (p.bloco.destaque) {
      linhas.push(`^FO${p.x - 8},${p.y - 7}^GB${LADO_DOTS - p.x - 12},${p.altura},${p.altura}^FS`)
      linhas.push(`^FO${p.x},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FR^FD${texto}^FS`)
    } else {
      // ⚠️ "negrito" em ZPL não é uma flag: engrossa-se imprimindo o texto 2× com 1 dot
      // de deslocamento. É o truque padrão da Zebra pra fonte escalável.
      linhas.push(`^FO${p.x},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FD${texto}^FS`)
      if (p.bloco.negrito) linhas.push(`^FO${p.x + 1},${p.y}^A0N,${p.bloco.fonte},${p.bloco.fonte}^FD${texto}^FS`)
    }
  }
  if (l.qr) linhas.push(`^FO${l.qr.x},${l.qr.y}^BQN,2,${l.qr.bloco.qrTamanho ?? 5}^FDLA,${zplSafe(l.qr.valor)}^FS`)
  return ['^XA', '^CI28', `^PW${LADO_DOTS}`, `^LL${LADO_DOTS}`, ...linhas, '^XZ'].join('\n')
}

// ---------------------------------------------------------------------------
// CONSUMIDOR 2 — a PRÉVIA (mesma função de layout)
// ---------------------------------------------------------------------------

export interface PreviaBloco {
  id: string
  texto: string
  esquerda: number
  topo: number
  fontePct: number
  alturaPct: number
  destaque: boolean
  negrito: boolean
  tipo: TipoBloco
  /** as duas partes da linha, pra o clique saber onde caiu */
  partes: { rotulo: string; conteudo: string }
  /** faixa vertical da linha em % — a área de clique cobre a LARGURA INTEIRA da etiqueta */
  topoPct: number
  /** % da largura da etiqueta que esta linha pode ocupar antes de a Zebra cortar */
  larguraPct: number
  /** ⚠️ estimativa — ver LARGURA_CALIBRADA */
  podeCortar: boolean
}

export function previaDosBlocos(blocos: Bloco[], dados: DadosEtiqueta): { campos: PreviaBloco[]; estourou: boolean; podeCortar: boolean } {
  const l = blocosParaLayout(blocos, dados)
  const pct = (n: number) => (n / LADO_DOTS) * 100
  const campos: PreviaBloco[] = l.blocos.map((p) => ({
    id: p.bloco.id, texto: p.valor,
    esquerda: pct(p.x), topo: pct(p.y),
    fontePct: pct(p.bloco.fonte), alturaPct: pct(p.altura),
    destaque: !!p.bloco.destaque, negrito: !!p.bloco.negrito, tipo: p.bloco.tipo,
    partes: p.partes, topoPct: pct(p.y),
    larguraPct: pct(p.larguraDisponivel), podeCortar: p.podeCortar,
  }))
  if (l.qr) {
    campos.push({
      id: 'qr', texto: l.qr.valor, esquerda: pct(l.qr.x), topo: pct(l.qr.y),
      fontePct: 0, alturaPct: pct(l.qr.altura), destaque: false, negrito: false, tipo: 'qr',
      partes: l.qr.partes, topoPct: pct(l.qr.y),
      larguraPct: pct(l.qr.altura), podeCortar: false,
    })
  }
  return { campos, estourou: l.estourou, podeCortar: l.podeCortar }
}

// ---------------------------------------------------------------------------
// ⚠️ O MÍNIMO SANITÁRIO — AVISA, NÃO TRAVA
// ---------------------------------------------------------------------------

/**
 * ⚠️ Regra do módulo aplicada de novo: **avisa, nunca trava**. Etiqueta sem validade não
 * atende a Vigilância — mas quem responde pela cozinha é o dono, e travar aqui só o
 * empurraria pra escrever a validade à mão numa fita crepe (que é pior: sai do sistema).
 */
export function avisosDoModelo(blocos: Bloco[]): string[] {
  const ativo = (campo: CampoId) => blocos.some((b) => b.ativo && b.tipo === 'campo' && b.campo === campo)
  const avisos: string[] = []
  if (!ativo('validade')) {
    avisos.push('Sem a VALIDADE, a etiqueta não atende a Vigilância Sanitária — e é a informação que evita servir comida vencida.')
  }
  if (!ativo('fabricacao')) {
    avisos.push('Sem a data de FABRICAÇÃO/manipulação não dá pra provar quando o produto foi feito.')
  }
  if (!ativo('produto')) {
    avisos.push('Sem o NOME do produto a etiqueta não identifica o que está no pacote.')
  }
  if (!ativo('lote') && !blocos.some((b) => b.ativo && b.tipo === 'qr')) {
    avisos.push('Sem LOTE nem QR não há rastro: se houver um problema, não dá pra saber de qual produção veio.')
  }
  return avisos
}

// ---------------------------------------------------------------------------
// SERIALIZAÇÃO (o que vai pro banco)
// ---------------------------------------------------------------------------

const CAMPOS_VALIDOS: CampoId[] = ['produto', 'fabricacao', 'validade', 'estado', 'lote', 'quantidade', 'colaborador', 'empresa', 'qr']

/**
 * Lê os blocos do banco com desconfiança: JSON é texto, e texto pode vir torto (edição
 * manual, versão antiga, bug). Bloco inválido é DESCARTADO, não derruba a etiqueta —
 * imprimir sem uma linha é melhor que não imprimir.
 */
export function lerBlocos(json: string | null | undefined): Bloco[] {
  if (!json) return BLOCOS_PADRAO
  try {
    const bruto = JSON.parse(json)
    if (!Array.isArray(bruto)) return BLOCOS_PADRAO
    const ok = bruto.filter((b: Partial<Bloco>) =>
      typeof b?.id === 'string' &&
      (b.tipo === 'texto' || b.tipo === 'qr' || (b.tipo === 'campo' && CAMPOS_VALIDOS.includes(b.campo as CampoId))) &&
      typeof b.fonte === 'number' && b.fonte >= 0 && b.fonte <= 120,
    ) as Bloco[]
    return ok.length ? ok : BLOCOS_PADRAO
  } catch {
    return BLOCOS_PADRAO
  }
}

export const gravarBlocos = (blocos: Bloco[]) => JSON.stringify(blocos)
