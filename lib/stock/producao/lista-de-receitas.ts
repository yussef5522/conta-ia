/**
 * ⭐⭐⭐ A LISTA DE RECEITAS DE PRODUÇÃO — busca, chips e os 2 blocos (12/10/2026).
 *
 * **Ordem do dono:** 44 receitas e ele caçando uma por uma na rolagem. Então: **busca ao vivo**,
 * **chips que contam**, e as **principais fixadas em cima** — a marca na mão dele.
 *
 * ⛔⛔ **POR QUE ISTO É LIB PURA E NÃO LÓGICA NA TELA:** o projeto roda em `environment: node`,
 * **sem jsdom** — regra que mora num `useState`/JSX é regra que **ninguém consegue provar** (a
 * cicatriz do prefill do cardápio, que quebrou 2× antes de virar função, e a do binding do
 * seletor de categoria em 17/09). Todo vermelho que o dono pediu neste sprint — *"ordem não
 * alfabética = vermelho"*, *"chip âmbar não filtra exatamente as a-definir = vermelho"*,
 * *"estrela liga → aparece em Principais e o chip conta +1"* — só é testável porque a decisão
 * mora aqui.
 *
 * ⛔ **E A BUSCA PASSA PELA `casaBusca`, A PORTA DA CASA.** `toLowerCase()/includes()` cru
 * aqui ressuscitaria o bug de 08/09: `contains` é case-SENSITIVE no Postgres e o acento não
 * se resolve com caixa — *"agua"* não acharia *"Água"*, *"calab"* não acharia *"CALABRESA"*.
 * A porta é importada, **nunca copiada**.
 */
import { casaBusca } from '@/lib/busca-texto'

/** ⭐ os três chips, união FECHADA: chip novo não compila sem entrar nos contadores */
export type ChipDaLista = 'TODAS' | 'PRINCIPAIS' | 'CUSTO_A_DEFINIR'

/** o mínimo que a régua precisa saber de uma receita (a tela manda a `FichaView` inteira) */
export interface ReceitaDaLista {
  id: string
  nomeProduzido: string
  principal: boolean
  custoADefinir: boolean
}

export interface BlocoDeReceitas<T> {
  chave: 'PRINCIPAIS' | 'OUTRAS' | 'RECORTE'
  /** `null` no modo recorte: ali a lista é UMA, e título de bloco só repetiria o filtro */
  titulo: string | null
  receitas: T[]
  /** ⭐ o convite do bloco vazio — nunca um bloco em branco, que se lê como defeito */
  convite: string | null
}

export interface ListaDeReceitas<T> {
  /** `BLOCOS` = o estado de abertura (sem busca e sem chip) · `RECORTE` = uma lista só */
  modo: 'BLOCOS' | 'RECORTE'
  blocos: BlocoDeReceitas<T>[]
  contadores: { todas: number; principais: number; custoADefinir: number }
  /** a frase do vazio — `null` quando há o que mostrar */
  vazio: string | null
}

/** ⭐ ordem alfabética pt-BR: sem o `localeCompare`, `Água` vai pro FIM da lista */
export function ordemAlfabetica<T extends { nomeProduzido: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.nomeProduzido.localeCompare(b.nomeProduzido, 'pt-BR'))
}

/**
 * ⭐ A RÉGUA. Recebe a lista que a tela JÁ carregou e devolve o que desenhar.
 *
 * ⚠️⚠️ **OS CONTADORES SAEM DO RECORTE DA BUSCA, não do universo** — e isto é a decisão mais
 * importante do arquivo. O chip é um FILTRO: o número nele é *"quantas eu vejo se clicar"*.
 * Contar o universo faria o chip dizer `principais · 8` e a lista mostrar 1 depois do clique
 * (porque a busca continua ativa) — exatamente a divergência *badge × tela* que esta casa
 * passou meses pagando no menu da Conciliação. **Chip e lista não podem discordar.**
 *
 * ⚠️ `todas` é o total do recorte da busca, então ele NÃO muda quando o dono troca de chip —
 * é o denominador honesto: *"de N que casam com o que digitei, M são principais"*.
 */
export function montarListaDeReceitas<T extends ReceitaDaLista>(
  entrada: { receitas: T[]; busca?: string; chip?: ChipDaLista },
): ListaDeReceitas<T> {
  const busca = (entrada.busca ?? '').trim()
  const chip: ChipDaLista = entrada.chip ?? 'TODAS'

  // 1. o recorte da BUSCA — pela porta da casa, sobre a MESMA lista que a tela renderiza
  const porBusca = busca === '' ? entrada.receitas : entrada.receitas.filter((r) => casaBusca(r.nomeProduzido, busca))

  const contadores = {
    todas: porBusca.length,
    principais: porBusca.filter((r) => r.principal).length,
    custoADefinir: porBusca.filter((r) => r.custoADefinir).length,
  }

  // 2. o recorte do CHIP, por cima da busca (os dois COMBINAM — pedido do dono)
  const recorte =
    chip === 'PRINCIPAIS' ? porBusca.filter((r) => r.principal)
      : chip === 'CUSTO_A_DEFINIR' ? porBusca.filter((r) => r.custoADefinir)
        : porBusca

  /**
   * ⭐ O ESTADO DE ABERTURA (2 blocos) só existe sem busca E sem chip. Com recorte ativo a
   * lista vira UMA — manter os blocos ali partiria 3 resultados em dois pedaços com título,
   * o que esconde o resultado em vez de organizar.
   */
  if (busca === '' && chip === 'TODAS') {
    /**
     * ⭐⭐ OS BLOCOS SÃO EXCLUSIVOS — decisão do dono (12/10), depois de usar a tela:
     * *"na hora de clica em estrella receita sai de tudo as receitas e ir para PRINCIPAIS e
     * nao fica no as 2 dai na hora de clica no estrela de novo ela volta aprace no tudos"*.
     *
     * ⚠️⚠️ **ISTO SUBSTITUI A DECISÃO DE HOJE DE MANHÃ** (o bloco de baixo continha TODAS).
     * Eu havia registrado as duas saídas como defensáveis e escolhido a inclusiva pelo
     * argumento do rótulo honesto; **ele usou e decidiu a outra** — e a mesma régua do rótulo
     * é o que obriga o passo seguinte: com as marcadas fora, *"Todas as receitas"* viraria
     * mentira, então o bloco de baixo passa a se chamar **"outras receitas"**.
     *
     * ⭐ E a divisão é uma PARTIÇÃO, não dois filtros soltos: `principal` é booleano, então
     * `principais + outras == o universo` **por construção** — nenhuma receita se perde no
     * meio nem conta duas vezes (há teste varrendo 0, 1, 2 e todas estreladas).
     */
    const principais = ordemAlfabetica(entrada.receitas.filter((r) => r.principal))
    const outras = ordemAlfabetica(entrada.receitas.filter((r) => !r.principal))
    return {
      modo: 'BLOCOS',
      contadores,
      vazio: null,
      blocos: [
        {
          chave: 'PRINCIPAIS',
          titulo: 'Principais',
          receitas: principais,
          convite: principais.length === 0 ? 'toque na estrela pra fixar as mais importantes aqui em cima' : null,
        },
        {
          chave: 'OUTRAS',
          titulo: 'outras receitas',
          receitas: outras,
          /**
           * ⚠️ Com tudo estrelado o bloco de baixo fica vazio — e vazio MUDO se lê como
           * defeito de render. Ele DIZ o que houve, a mesma régua do convite de cima.
           */
          convite: outras.length === 0 && principais.length > 0 ? 'todas as receitas estão fixadas aqui em cima' : null,
        },
      ],
    }
  }

  /** ⭐ o vazio DIZ o recorte — *"nenhuma receita"* seco faria o dono achar que não existe */
  const vazio = recorte.length === 0
    ? busca !== ''
      ? `nenhuma receita com “${busca}”`
      : chip === 'PRINCIPAIS'
        ? 'nenhuma receita marcada como principal ainda'
        : 'nenhuma receita com o custo a definir — todas têm custo fechado'
    : null

  return {
    modo: 'RECORTE',
    contadores,
    vazio,
    blocos: [{ chave: 'RECORTE', titulo: null, receitas: ordemAlfabetica(recorte), convite: null }],
  }
}
