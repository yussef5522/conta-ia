// VENDAS FASE 1 (17/08/2026) — feriados nacionais BANCÁRIOS. O que importa pro
// "quando o dinheiro chega" é quando o BANCO não liquida: os fixos nacionais +
// os móveis em que a Febraban não opera (Carnaval seg+ter, Sexta-feira Santa,
// Corpus Christi). Função PURA por ANO — o ano vem do DADO (data da linha), NUNCA
// do relógio de parede (mesma disciplina do import: relógio só exibe, não decide).
// Feriado municipal é editável por empresa (tabela FeriadoMunicipal), somado por cima.

/** 'YYYY-MM-DD' em UTC — a chave canônica de dia (sem horário, sem timezone local). */
export function diaUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário Gregoriano).
function domingoDePascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31) // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function addDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

/** Feriados nacionais bancários de UM ano, como Set de 'YYYY-MM-DD'. */
export function feriadosNacionais(ano: number): Set<string> {
  const s = new Set<string>()
  // Fixos
  const fixos: [number, number][] = [
    [1, 1], // Confraternização
    [4, 21], // Tiradentes
    [5, 1], // Trabalho
    [9, 7], // Independência
    [10, 12], // N. Sra. Aparecida
    [11, 2], // Finados
    [11, 15], // Proclamação da República
    [11, 20], // Consciência Negra (nacional desde Lei 14.759/2024)
    [12, 25], // Natal
  ]
  for (const [mes, dia] of fixos) s.add(diaUTC(new Date(Date.UTC(ano, mes - 1, dia))))
  // Móveis (banco não liquida): Carnaval seg+ter, Sexta-feira Santa, Corpus Christi
  const pascoa = domingoDePascoa(ano)
  s.add(diaUTC(addDias(pascoa, -48))) // Carnaval segunda
  s.add(diaUTC(addDias(pascoa, -47))) // Carnaval terça
  s.add(diaUTC(addDias(pascoa, -2))) // Sexta-feira Santa
  s.add(diaUTC(addDias(pascoa, 60))) // Corpus Christi
  return s
}

/** União de vários anos (pro caso de janela que cruza o Ano Novo). */
export function feriadosNacionaisAnos(anos: number[]): Set<string> {
  const s = new Set<string>()
  for (const ano of anos) for (const f of feriadosNacionais(ano)) s.add(f)
  return s
}
