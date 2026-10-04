/**
 * ⭐ AVATAR DE PESSOA — iniciais + cor ESTÁVEL por nome (04/10/2026).
 *
 * **Pedido do dono:** *"avatar circular com iniciais, cor estável por pessoa (hash do nome →
 * paleta), nome ao lado em secondary."*
 *
 * ⚠️ **ESTÁVEL é o ponto, não "bonito":** a cor é derivada do HASH do nome, então a mesma
 * pessoa tem a mesma cor em toda linha, em todo dia, em toda sessão. Cor sorteada no render
 * faria o olho perder o reconhecimento justamente na coluna que existe pra ser reconhecida.
 *
 * ⛔ E a paleta é a DA CASA (os tons do radar). Um conjunto "quase igual" aqui seria a terceira
 * paleta do projeto — é o que fez o verde do cartão ≍ e o do card de 10/09 saírem diferentes.
 */

import { RADAR } from './radar-tokens'

/**
 * ⭐ Os tons que sobraram pra identidade de pessoa: roxo, azul, teal, verde, âmbar.
 *
 * ⛔ **O CORAL FICA DE FORA DE PROPÓSITO** — nesta casa ele significa *"algo está errado"*
 * (eficiência fora da faixa, saldo negativo). Pintar uma pessoa de vermelho porque o hash
 * caiu ali seria a cor mentindo sobre ela.
 */
const PALETA = [
  { bg: RADAR.roxoBg, cor: RADAR.roxo },
  { bg: RADAR.azulBg, cor: RADAR.azul },
  { bg: RADAR.tealBg, cor: RADAR.teal },
  { bg: RADAR.verdeBg, cor: RADAR.verde },
  { bg: RADAR.ambarBg, cor: RADAR.ambar },
] as const

/**
 * PURA. Hash estável (djb2) → índice da paleta.
 *
 * ⚠️ Normaliza caixa e espaço antes: `"rodrigo"`, `"Rodrigo"` e `"rodrigo "` são a MESMA
 * pessoa, e a cicatriz da conta `'sicredi '` (25/08) é o lembrete de que o espaço no fim
 * existe no dado real desta casa.
 */
export function corDaPessoa(nome: string): (typeof PALETA)[number] {
  const n = nome.trim().toLowerCase()
  let h = 5381
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0
  return PALETA[Math.abs(h) % PALETA.length]
}

/**
 * PURA. As iniciais: 1ª letra do 1º e do ÚLTIMO nome.
 *
 * ⚠️ Pelo ÚLTIMO, não pelo segundo: *"Yussef Abu Zahry Musa"* dá **YM**, não **YA** — é como
 * uma pessoa é reconhecida. Nome único devolve 1 letra; vazio devolve `?` (nunca string vazia,
 * que viraria um círculo mudo).
 */
export function iniciais(nome: string): string {
  const ps = nome.trim().split(/\s+/).filter(Boolean)
  if (!ps.length) return '?'
  if (ps.length === 1) return ps[0][0].toUpperCase()
  return (ps[0][0] + ps[ps.length - 1][0]).toUpperCase()
}

/**
 * ⭐ `apenasAvatar` desenha SÓ o círculo (04/10) — a home da Produção põe o nome na sublinha,
 * e repetir ele ao lado do avatar seria a mesma informação duas vezes na mesma linha.
 * ⚠️ O `title` fica no círculo nos dois modos: sem o nome escrito, as iniciais precisam de
 * alguém que as traduza no hover.
 */
export function AvatarPessoa({ nome, tamanho = 22, apenasAvatar = false }: {
  nome: string | null; tamanho?: number; apenasAvatar?: boolean
}) {
  /**
   * ⛔ SEM NOME NÃO INVENTA PESSOA: um círculo com `?` e o texto *"—"*. A ordem antiga sem
   * colaborador registrado é um FATO (ninguém assinou), não um nome que a tela deve adivinhar.
   */
  if (!nome) {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--prod-muted)' }}>
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
          style={{ width: tamanho, height: tamanho, background: 'var(--prod-mudo-bg)', color: 'var(--prod-mudo)' }}
          aria-hidden
          title="sem responsável registrado"
        >
          ?
        </span>
        {!apenasAvatar && <span className="text-[13px]">—</span>}
      </span>
    )
  }
  const c = corDaPessoa(nome)
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={nome}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
        style={{ width: tamanho, height: tamanho, background: c.bg, color: c.cor }}
        aria-hidden
      >
        {iniciais(nome)}
      </span>
      {!apenasAvatar && <span className="truncate text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{nome}</span>}
    </span>
  )
}
