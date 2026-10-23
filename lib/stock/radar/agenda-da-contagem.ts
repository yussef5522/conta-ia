// ⭐⭐⭐ A AGENDA DE CONTAGEM POR GRUPO (RT3 da referência, 22/10/2026) — REGRA PURA.
//
// RT3: *"chips TODO DIA ou SEG–DOM no cabeçalho; mostra última contagem e a próxima; HOJE é
// dia → selo 'CONTAR HOJE' + botão 📋 contar agora; contagem ATRASADA → coral."*
//
// ⛔⛔ **O RELÓGIO NÃO ENTRA AQUI.** `hoje` é PARÂMETRO ('YYYY-MM-DD', o dia de São Paulo
// resolvido pelo SERVIDOR). É a régua da casa em duas camadas:
//   · *"o relógio só serve pra exibir 'hoje' na TELA — nunca entra em decisão"* (13/08)
//   · e `hoje` decidido na ROTA, nunca no cliente (dia-ao-vivo, 06/09): aparelho com a hora
//     torta acenderia "CONTAR HOJE" num dia e o recorte seria de outro
// Quem responde "que dia é hoje em SP" é o dono único `lib/datas/dia-sao-paulo.ts`.
//
// ⚠️ **SEG-FIRST** (0=SEG … 6=DOM), a mesma convenção do `diasChegada` de
// `stock_compra_config` (16/10) e do `DIAS` do `<script>` da referência. **NÃO é o
// `getDay()` do JavaScript**, que é DOM-first — misturar as duas é como o selo passa a
// acender no dia errado, e a conversão mora NESTE arquivo, num lugar só.
//
// ⛔⛔ **ESTE ARQUIVO NÃO IMPORTA BANCO, E ISSO É ESTRUTURAL.** A TELA lê daqui
// (`DIAS_SEG_FIRST` nos chips, o selo no cabeçalho). Se o vocabulário morasse em
// `grupos.ts` — que importa `@/lib/db` —, um `import` do componente arrastaria o
// **PrismaClient pro bundle do cliente**. A seta é sempre porta → regra pura, nunca o
// contrário: `grupos.ts` importa DAQUI.

import { somarDias } from '@/lib/datas/dia-sao-paulo'

/**
 * ⭐ O VOCABULÁRIO DOS DIAS, SEG-first — o índice É o valor gravado em `agendaDias`.
 *
 * ⚠️ A ordem desta lista é a ordem dos chips na tela E o significado do CSV no banco: mexer
 * nela reinterpreta todo dado já gravado (o SEX de ontem viraria outro dia). Ela não muda.
 */
export const DIAS_SEG_FIRST = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const

export type EstadoDaAgenda =
  /** hoje é dia de contar e já contaram */
  | 'CONTADO_HOJE'
  /** hoje é dia de contar e ninguém contou ainda */
  | 'CONTAR_HOJE'
  /** o dia de contar PASSOU e ninguém contou */
  | 'ATRASADA'
  /** hoje não é dia; o próximo tem data */
  | 'PROXIMA'
  /** o grupo não tem dia de contagem escolhido */
  | 'SEM_DIA'

export type TomDaAgenda = 'VERDE' | 'AMBAR' | 'CORAL' | 'NEUTRO'

export interface Agenda {
  todoDia: boolean
  /** SEG-first, 0..6 */
  dias: number[]
}

export interface SeloDaAgenda {
  estado: EstadoDaAgenda
  /** o texto do selo no cabeçalho do grupo */
  texto: string
  tom: TomDaAgenda
  /** ⭐ o que a LINHA do item escreve no lugar de "falta contar": `conta <contaEm>` */
  contaEm: string
  /** o "última: <quando>" do cabeçalho */
  ultima: string
  nuncaContado: boolean
  /** ⭐ quando o botão "📋 contar agora" aparece */
  ofereceContarAgora: boolean
}

/**
 * ⭐ O DIA DA SEMANA DE UM DIA DE CALENDÁRIO, SEG-first.
 *
 * ⚠️ Lê em UTC de propósito, espelhando o `somarDias` do dono único: aqui não há hora
 * nenhuma envolvida — 'YYYY-MM-DD' já É o dia de São Paulo, resolvido antes de entrar. Usar
 * o fuso local da máquina aqui faria o servidor em UTC devolver o dia da semana errado nas
 * três últimas horas de todo dia.
 */
export function diaDaSemanaSegFirst(dia: string): number {
  const d = new Date(`${dia}T12:00:00.000Z`)
  return (d.getUTCDay() + 6) % 7
}

/** quantos dias de calendário separam dois dias ('YYYY-MM-DD') */
function distanciaEmDias(de: string, ate: string): number {
  const a = new Date(`${de}T12:00:00.000Z`).getTime()
  const b = new Date(`${ate}T12:00:00.000Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * ⭐ O RÓTULO CURTO — o que entra em "conta <isto>".
 *
 * Espelha o `rotuloAgenda(g, curto)` do `<script>` da referência: todo dia → "hoje";
 * dias → "sex" / "seg/qui" em minúscula; sem dia → "—".
 */
export function rotuloCurtoDaAgenda(agenda: Agenda): string {
  if (agenda.todoDia) return 'hoje'
  if (agenda.dias.length === 0) return '—'
  return agenda.dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEG_FIRST[d].toLowerCase())
    .join('/')
}

/** o rótulo longo, pra legenda do grupo ("todo dia" · "SEG · QUI" · "sem dia") */
export function rotuloLongoDaAgenda(agenda: Agenda): string {
  if (agenda.todoDia) return 'todo dia'
  if (agenda.dias.length === 0) return 'sem dia'
  return agenda.dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEG_FIRST[d])
    .join(' · ')
}

/**
 * ⭐ "última: <quando>" — e `nunca` é um FATO, não um buraco.
 *
 * ⛔ Nunca "há 0 dias": hoje é "hoje" e ontem é "ontem", porque é assim que o dono fala —
 * e a referência escreve exatamente isso (*"ontem · qua"*, *"sex · há 6 dias"*).
 */
export function textoDaUltima(hoje: string, ultimaContagem: string | null): string {
  if (!ultimaContagem) return 'nunca'
  const atras = distanciaEmDias(ultimaContagem, hoje)
  const dia = DIAS_SEG_FIRST[diaDaSemanaSegFirst(ultimaContagem)]
  if (atras <= 0) return 'hoje'
  if (atras === 1) return `ontem · ${dia.toLowerCase()}`
  return `${dia.toLowerCase()} · há ${atras} dias`
}

/**
 * ⭐⭐ O SELO DO CABEÇALHO. PURA.
 *
 * ═══ A ORDEM DAS PERGUNTAS É A REGRA, e cada degrau tem motivo ═══
 *
 * 1. **sem dia nenhum** → `SEM_DIA`. Não dá pra estar atrasado numa rotina que não existe;
 *    inventar atraso aqui seria pintar de coral todo grupo que o dono ainda não configurou.
 * 2. **contou hoje** → `CONTADO_HOJE`, mesmo que o dia de hoje não seja dia de contagem.
 *    *Contagem a mais nunca é problema*, e dizer "próxima SEX" no dia em que ele acabou de
 *    contar faria a tela ignorar o trabalho que ele fez.
 * 3. **ATRASADA** — o último dia devido que já FECHOU (estritamente antes de hoje) não tem
 *    contagem cobrindo ele. ⛔ Ela vem ANTES do `CONTAR_HOJE` de propósito: quando hoje
 *    também é dia e o anterior ficou pra trás, o coral é a notícia (a ação é a mesma —
 *    contar agora), e dizer só "CONTAR HOJE" esconderia o dia perdido.
 * 4. hoje é dia → `CONTAR_HOJE`.
 * 5. senão → `PROXIMA`, com a contagem de dias.
 *
 * ⚠️⚠️ **DECISÃO DECLARADA: grupo que NUNCA foi contado não é ATRASADA.** "Atrasada"
 * afirmaria um atraso contra uma rotina que nunca começou — e pintaria de coral todo grupo
 * recém-criado no 2º dia, que é como um alarme morre nesta casa. É a família do
 * *"ausência de MEDIÇÃO não é ausência de FATO"*: o que falta ali não é prazo, é a primeira
 * contagem — e isso o cabeçalho já diz com **"última: nunca"** (`nuncaContado` viaja no
 * selo justamente pra a tela não precisar deduzir).
 *
 * ⚠️ **E TODO DIA nunca mostra ATRASADA**, pelo mesmo motivo: com o dia devido sendo todo
 * dia, o selo ficaria coral permanente pra qualquer grupo diário que pulasse uma manhã — e
 * `CONTAR HOJE` já é o pedido correto, todo dia.
 */
export function seloDaAgenda(input: {
  agenda: Agenda
  hoje: string
  ultimaContagem: string | null
}): SeloDaAgenda {
  const { agenda, hoje, ultimaContagem } = input
  const dias = [...new Set(agenda.dias)].sort((a, b) => a - b)
  const contaEm = rotuloCurtoDaAgenda({ todoDia: agenda.todoDia, dias })
  const ultima = textoDaUltima(hoje, ultimaContagem)
  const nuncaContado = !ultimaContagem
  const contouHoje = !!ultimaContagem && distanciaEmDias(ultimaContagem, hoje) <= 0

  const base = { contaEm, ultima, nuncaContado }

  // 1 — sem rotina não há prazo
  if (!agenda.todoDia && dias.length === 0) {
    return {
      ...base,
      estado: 'SEM_DIA',
      texto: 'sem dia de contagem',
      tom: 'NEUTRO',
      ofereceContarAgora: false,
    }
  }

  // 2 — contou hoje: o trabalho feito ganha de qualquer prazo
  if (contouHoje) {
    return {
      ...base,
      estado: 'CONTADO_HOJE',
      texto: 'contado hoje ✓',
      tom: 'VERDE',
      ofereceContarAgora: false,
    }
  }

  const hojeEhDia = agenda.todoDia || dias.includes(diaDaSemanaSegFirst(hoje))

  // 3 — atrasada (só com histórico, e nunca no TODO DIA — ver a decisão declarada acima)
  if (!agenda.todoDia && ultimaContagem) {
    const devido = ultimoDiaDevidoFechado(dias, hoje)
    if (devido && distanciaEmDias(ultimaContagem, devido) > 0) {
      const atras = distanciaEmDias(devido, hoje)
      const dia = DIAS_SEG_FIRST[diaDaSemanaSegFirst(devido)]
      return {
        ...base,
        estado: 'ATRASADA',
        texto: `atrasada desde ${dia} (${atras}d)`,
        tom: 'CORAL',
        ofereceContarAgora: true,
      }
    }
  }

  // 4 — hoje é dia
  if (hojeEhDia) {
    return {
      ...base,
      estado: 'CONTAR_HOJE',
      texto: 'CONTAR HOJE',
      tom: 'AMBAR',
      ofereceContarAgora: true,
    }
  }

  // 5 — a próxima, com a distância escrita
  const prox = proximoDiaDevido(dias, hoje)
  if (!prox) {
    return { ...base, estado: 'SEM_DIA', texto: 'sem dia de contagem', tom: 'NEUTRO', ofereceContarAgora: false }
  }
  return {
    ...base,
    estado: 'PROXIMA',
    texto: `próxima ${DIAS_SEG_FIRST[prox.dia]} (em ${prox.emDias}d)`,
    tom: 'NEUTRO',
    ofereceContarAgora: false,
  }
}

/**
 * o último dia devido que já fechou — estritamente ANTES de hoje.
 *
 * ⚠️ Olha 7 dias pra trás porque a agenda é semanal: além disso o "atraso" seria sobre um
 * ciclo que a semana seguinte já repetiu, e o número perderia o sentido.
 */
function ultimoDiaDevidoFechado(dias: number[], hoje: string): string | null {
  for (let k = 1; k <= 7; k++) {
    const dia = somarDias(hoje, -k)
    if (dias.includes(diaDaSemanaSegFirst(dia))) return dia
  }
  return null
}

/** o próximo dia devido — espelha o laço `for(k=1..7)` do `<script>` da referência */
function proximoDiaDevido(dias: number[], hoje: string): { dia: number; emDias: number } | null {
  for (let k = 1; k <= 7; k++) {
    const d = (diaDaSemanaSegFirst(hoje) + k) % 7
    if (dias.includes(d)) return { dia: d, emDias: k }
  }
  return null
}
