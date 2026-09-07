// ⭐ A FRASE DO AVISO — PURA, e num arquivo só (06/09/2026).
//
// ⚠️ Mora separada de `encerrar-etapas-abertas.ts` por um motivo prático: aquele arquivo
// importa o Prisma, e a TELA de conclusão é client component — importar de lá arrastaria o
// Prisma pro bundle do navegador. Aqui o servidor e a tela leem a MESMA redação (REGRA 4);
// duas versões da frase divergiriam no dia em que uma delas mudasse.

export interface EtapaAbertaResumo { nome: string; executorNome: string | null }

/**
 * O aviso do caminho do encarregado — **decisão consciente, nunca efeito colateral**.
 *
 * ⚠️ Ela ENSINA A SAÍDA (*"peça pra finalizar no tablet primeiro"*): aviso que só comunica um
 * estrago treina o leitor a clicar em OK sem ler. E **não bloqueia** — quem decide é o
 * encarregado; travar aqui o empurraria a concluir por fora, que é pior.
 */
export function avisoDeEtapasAbertas(abertas: EtapaAbertaResumo[]): string | null {
  if (!abertas.length) return null
  const quem = abertas.map((a) => `“${a.nome}”${a.executorNome ? ` (${a.executorNome})` : ''}`).join(' e ')
  const plural = abertas.length > 1
  return `${plural ? 'As etapas' : 'A etapa'} ${quem} ${plural ? 'estão abertas e serão encerradas' : 'está aberta e será encerrada'} `
    + `sem tempo medido. Se ${plural ? 'elas terminaram' : 'ela terminou'} de verdade, peça pra finalizar no tablet primeiro — `
    + `assim o tempo entra na média.`
}
