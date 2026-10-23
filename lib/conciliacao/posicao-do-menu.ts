// ⭐ ONDE O MENU DO CHIP CABE — hoje este arquivo é só a PORTA (23/10/2026).
//
// ⚠️ A conta mudou de casa pra `lib/ui/posicao-flutuante.ts` quando o seletor de item do
// Real × Teórico caiu no MESMO defeito de recorte (`overflow-hidden` no card). A pergunta —
// *"onde cabe um painel ancorado num elemento?"* — não é de conciliação, é de UI; e escrever
// a 2ª cópia lá seria a doença que este repo mais paga.
//
// ⭐ Isto é **re-export, não cópia**: o `menu-do-chip.tsx` e o
// `gesto-nao-efetiva-pela-metade.test.ts` seguem importando daqui, sem uma linha tocada, e
// existe **UMA** conta. O default de largura continua o do menu de ações (320).

export type { Retangulo, Janela } from '@/lib/ui/posicao-flutuante'
export { posicaoFlutuante as posicaoDoMenu } from '@/lib/ui/posicao-flutuante'
export type { PosicaoFlutuante as PosicaoDoMenu } from '@/lib/ui/posicao-flutuante'
