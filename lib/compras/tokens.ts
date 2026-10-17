/**
 * ⭐⭐ OS TOKENS DE CONSUMO & COMPRAS — O MAPA 1:1 QUE A REFERÊNCIA MANDA FAZER.
 *
 * `docs/consumo-e-compras-referencia.html` declara a paleta em tokens GENÉRICOS (`--bg`,
 * `--tinta`, `--acao`…) e o comentário do arquivo manda **mapear 1:1 para o token da casa**.
 * Este arquivo é esse mapa, e o guard `consumo-e-compras-bate-com-a-referencia` confere que
 * **todo token do `:root{}` dela tem par aqui**.
 *
 * ⚠️⚠️ **O PAR É POR PAPEL, NUNCA POR HEX.** O `--verde` da referência é `#2EE6A8` e o
 * `--fam-verde-mid` da casa é outro tom: são verdes diferentes do MESMO papel, e o da casa é
 * o que **inverte nos dois temas** junto com o resto do sistema. Cravar o hex da referência
 * trocaria a paleta da casa pela do arquivo de exemplo — e aí esta tela ficaria com um verde
 * só dela, que é exatamente como o verde do cartão ≍ e o do card de 10/09 acabaram diferentes.
 *
 * ⭐ **E É POR ISSO QUE O TEMA CLARO SAI DE GRAÇA.** A referência é **dark-first** (o `:root`
 * cru carrega o escuro; o `:root[data-theme="light"]` carrega o claro) — mas aqui ninguém
 * repinta nada: os tokens da casa já invertem na fundação (14/10). ⛔ **Zero hex nesta tela**
 * é o que faz a lei *"dark-first com o light obedecendo"* ser construção, não disciplina.
 */

/** ⭐ o papel de cada cor, no vocabulário da REFERÊNCIA — a tela lê daqui e de nenhum outro lugar */
export const CC = {
  /** `--bg` → o papel da página */
  bg: 'var(--prod-bg)',
  /** `--mod` → o chão do módulo */
  mod: 'var(--prod-surface)',
  /** `--mod-2` → o bloco interno (stat, cabeçalho do card de pedido, zebra) */
  mod2: 'var(--prod-surface-1)',
  /** `--linha` → a divisória de linha */
  linha: 'var(--prod-line)',
  /** `--linha-forte` → a borda de cartão e a régua de cabeçalho */
  linhaForte: 'var(--prod-line-strong)',
  /** `--tinta` → número, nome, título */
  tinta: 'var(--prod-primary)',
  /** `--tinta-2` → apoio */
  tinta2: 'var(--prod-secondary)',
  /** ⚠️ `--tinta-3` → SÓ dica/metadado. Proibido conteúdo aqui (L2 da fundação). */
  tinta3: 'var(--prod-muted)',
  /** `--acao` → o índigo que pinta barra, chip e o número de PEDIR */
  acao: 'var(--fam-indigo-mid)',
  /** `--acao-fundo` → o chão claro do índigo (caixa do PEDIR, pílula de prazo) */
  acaoFundo: 'var(--fam-indigo-bg)',
  /** `--acao-vivo` → o chip LIGADO e o hover do − / + */
  acaoVivo: 'var(--prod-accent)',
  /**
   * ⭐⭐ a tinta sobre fundo FORTE — e ela **não existe na referência**, que crava `#fff`.
   * ⚠️ O par da casa (04/10) **inverte**: branco no claro, quase-preto no escuro. Cravar
   * branco deixaria o chip aceso ilegível no tema que o dono mais usa.
   */
  sobreForte: 'var(--prod-acao-ink)',
  verde: 'var(--fam-verde-mid)',
  /** `--verde-chao` → o chão SÓLIDO do chip de dia-de-chegada ligado */
  verdeChao: 'var(--fam-verde-solid)',
  /** a tinta que pareia com o chão sólido verde — medida pra passar nos dois temas */
  verdeSobre: 'var(--fam-verde-on)',
  verdeFundo: 'var(--fam-verde-bg)',
  coral: 'var(--fam-coral-mid)',
  coralFundo: 'var(--fam-coral-bg)',
  ambar: 'var(--fam-ambar-mid)',
  ambarFundo: 'var(--fam-ambar-bg)',
  /** `--r` → o raio do módulo */
  raio: 'var(--prod-r-cartao)',
} as const

/**
 * ⭐ O SEMÁFORO DA COBERTURA (lei C13) — decidido no SERVIDOR (`farolDaCobertura`), pintado aqui.
 *
 * ⛔ Uma régua de cor própria na tela seria a 2ª resposta pra *"este item está apertado?"*, e
 * ela divergiria do radar ① no primeiro ajuste de degrau — o radar lê o MESMO `farol`.
 */
export const FAROL: Record<string, { cor: string; fundo: string }> = {
  CORAL: { cor: CC.coral, fundo: CC.coralFundo },
  AMBAR: { cor: CC.ambar, fundo: CC.ambarFundo },
  VERDE: { cor: CC.verde, fundo: CC.verdeFundo },
  /** ⛔ "a apurar" é estado PRÓPRIO e CINZA — nunca um verde pálido (ausência ≠ tranquilo) */
  A_APURAR: { cor: CC.tinta3, fundo: CC.mod2 },
}

/** ⭐ as medidas que a referência declara — escritas como ELA escreve, sem tradução mental */
export const MED = {
  /** `.miolo{max-width:1440px}` */
  teto: '1440px',
  /** `.heroi .giga{font-size:46px}` — o número é o herói (lei C3) */
  giga: '46px',
  /** `.heroi .giga small` */
  gigaUn: '20px',
  /** `.ped-row .uso` — o uso na semana, 2º maior da linha */
  uso: '16.5px',
  /** `.qtd .q` — o PEDIR, o maior número da mesa (lei C8) */
  pedir: '19px',
  /** `.stat .n` */
  statN: '19px',
  /** `.barras{height:120px}` */
  barras: '120px',
  /** `.spark8{height:44px}` */
  spark: '44px',
} as const
