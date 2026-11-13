// ⭐ (13/11/2026) "HOJE" SÓ QUANDO O DIA OLHADO É HOJE. PURA — `agora` é parâmetro (o relógio só
// EXIBE "hoje", nunca decide num teste). ⛔ O Hoje ao vivo navega pelos dias passados com ‹ ›, e
// "nenhum lote fechado ainda hoje" num sábado passado é uma frase falsa sobre aquele sábado.
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

export function palavraDoDia(dia: string, agora: Date): { ehHoje: boolean; dia: 'hoje' | 'neste dia'; ainda: string } {
  const ehHoje = diaEmSaoPaulo(agora) === dia
  return { ehHoje, dia: ehHoje ? 'hoje' : 'neste dia', ainda: ehHoje ? 'ainda hoje' : 'neste dia' }
}
