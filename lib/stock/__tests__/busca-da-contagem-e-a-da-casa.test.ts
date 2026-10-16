/**
 * ⛔⛔⛔ **A BUSCA DA CONTAGEM VOLTOU A SER A DA CASA (16/10/2026).**
 *
 * **O defeito, medido em prod (15/10) com os 380 itens ativos da Caçula:**
 * ```
 * o dono digita "porcao" → a régua de lá achava 15 · a casa acha 22   (7 invisíveis)
 * o dono digita "porçao" → achava  7 · a casa acha 22                 (15 invisíveis)
 * o dono digita "acem"   → achava  0 · a casa acha  1   ⛔ "Acém" NUNCA aparecia
 * ```
 * ⚠️⚠️ **O pior não é achar pouco — é que, *qualquer coisa que ele digitasse, ele nunca via
 * TODOS*.** E item que não aparece na busca é item que fica sem contar, que é exatamente o que
 * a tela de contagem existe pra impedir. É o bug de 08/09 (`contains` case-sensitive) vivendo
 * nestes dois componentes.
 *
 * ⛔⛔ **ERAM DOIS LUGARES, não um (REGRA 4).** O dono relatou na **revisão**, e o `includes`
 * cru estava também na **fila do modo CONTAR** (`trilho-fila.tsx`) — e é nela que o item é
 * procurado na câmara fria, com o celular na mão. ***Consertar só a que ele viu deixaria a
 * outra mentindo.***
 *
 * ⛔⛔⛔ **E ESTE ARQUIVO TEM AS DUAS METADES, de propósito:**
 *   1. a RÉGUA responde certo (fixture com as grafias REAIS, mais os contrafactuais do cru);
 *   2. as DUAS TELAS **consomem a porta** — porque *"guard que testa a lib aprova a tela que a
 *      ignora"* já custou caro aqui (o encaixe do seletor de universo, 16/09). A régua sempre
 *      esteve certa; quem não a chamava eram as telas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { casaBusca } from '@/lib/busca-texto'
import { semComentarios, usosDe } from '@/__tests__/regras-ui/_leitura-de-fonte'

/**
 * ⭐ As duas grafias convivem no catálogo REAL — é isso que torna o defeito tão caro: o dono
 * não tem como saber qual delas o fornecedor usou, e a régua velha exigia que ele acertasse.
 */
const ITENS = [
  'porçao queijo 135 grama',
  'porçao calabresa ralada 50 grama',
  'porçao frango frito 200 grama',
  'porçao queijo empanado 100 grama',
  'porcao coxao 80 grama',
  'porcao bacon 80 grama',
  'porcao file xis 150 grama',
  'porcao chuleta',
  'porcao de calabresa 120 grama',
  'porcao iscas de frango',
  'Acém',
  'Coxão Mole',
  'PAO DE XIS',
  'COCA-COLA 2L',
]

const acha = (termo: string, regua: (texto: string, t: string) => boolean) =>
  ITENS.filter((n) => regua(n, termo))

/** ⛔ a régua VELHA, escrita aqui pro contrafactual existir e ser medível */
const crua = (texto: string, termo: string) =>
  texto.toLowerCase().includes(termo.trim().toLowerCase())

describe('⭐⭐ a régua da casa acha o item seja como o dono escrever', () => {
  it('⭐ "porcao" e "porçao" devolvem O MESMO conjunto', () => {
    const semCedilha = acha('porcao', casaBusca)
    const comCedilha = acha('porçao', casaBusca)

    expect(semCedilha.sort()).toEqual(comCedilha.sort())
    expect(semCedilha, 'as 10 porções, nas duas grafias').toHaveLength(10)
  })

  it('⛔⛔ CONTRAFACTUAL — a régua crua PARTE o conjunto em dois', () => {
    /**
     * É a assimetria exata de prod: cada grafia só achava a própria metade, e nenhuma das
     * duas achava tudo. **Com `includes` cru não existe termo que devolva os 10.**
     */
    expect(acha('porcao', crua)).toHaveLength(6)
    expect(acha('porçao', crua)).toHaveLength(4)
    expect(acha('porcao', crua).length + acha('porçao', crua).length).toBe(10)
  })

  it('⭐⭐ "acem" acha "Acém" — e o cru NUNCA acha', () => {
    expect(acha('acem', casaBusca)).toEqual(['Acém'])
    expect(acha('acem', crua), 'o caso que o dono nomeou: o item é invisível').toHaveLength(0)
  })

  it('⭐ "coxao" acha "Coxão Mole" e "porcao coxao 80 grama"', () => {
    expect(acha('coxao', casaBusca).sort()).toEqual(['Coxão Mole', 'porcao coxao 80 grama'])
    expect(acha('coxao', crua), 'o cru perde o "Coxão"').toEqual(['porcao coxao 80 grama'])
  })

  it('⭐ palavra em QUALQUER ORDEM — "queijo porcao" acha as de queijo', () => {
    /** o nome vem da NOTA, não da cabeça de quem conta: exigir a ordem é exigir memória */
    expect(acha('queijo porcao', casaBusca)).toHaveLength(2)
    expect(acha('queijo porcao', crua), 'o cru exige a frase inteira, na ordem').toHaveLength(0)
  })

  it('⛔ busca vazia mostra TUDO — "não digitei" não é "nada casa"', () => {
    expect(acha('', casaBusca)).toHaveLength(ITENS.length)
    expect(acha('   ', casaBusca)).toHaveLength(ITENS.length)
  })

  it('⛔ termo que não existe devolve VAZIO — a régua filtra de verdade', () => {
    expect(acha('zzzz', casaBusca)).toHaveLength(0)
  })
})

/**
 * ⛔⛔ **O ENCAIXE — sem jsdom não dá pra digitar no teste, então o guard é ESTRUTURAL e
 * assumido como tal.** Ele lê a fonte **sem comentário**: este arquivo e os dois componentes
 * documentam o defeito removido, e *o arquivo que documenta o defeito não pode ser o que o
 * absolve* (a cicatriz de 21/09).
 */
const TELAS = [
  'components/estoque/contagem/revisao-contagem.tsx',
  'components/estoque/contagem/trilho-fila.tsx',
]

describe('⛔⛔ as DUAS telas da contagem usam a porta, nunca régua própria', () => {
  for (const rel of TELAS) {
    const src = () => semComentarios(readFileSync(join(process.cwd(), rel), 'utf8'))

    it(`⭐ ${rel} CHAMA casaBusca`, () => {
      /**
       * ⚠️ `usosDe` conta o USO **ignorando import e comentário** — é a diferença entre
       * *"a linha do `import` existe"* e *"a tela chama"*. É a cicatriz *"menção, não uso"*,
       * que nesta casa já deixou 17 guards verdes com o defeito de volta.
       */
      expect(usosDe(src(), 'casaBusca'), 'não é menção de import: é USO').toBeGreaterThan(0)
    })

    it(`⛔ ${rel} não compara texto na mão`, () => {
      const s = src()
      /**
       * ⚠️ A régua é sobre COMPARAR TEXTO, não sobre a palavra `toLowerCase` — ela é legítima
       * pra EXIBIR (`dec.decisao.toLowerCase()` imprime "contou errado" em minúsculas). O que
       * não pode voltar é a comparação: `.toLowerCase().includes(` numa frase só.
       */
      expect(s, 'o `includes` cru é o bug de 08/09').not.toMatch(/toLowerCase\(\)\s*\.\s*includes\(/)
      expect(s, 'nem o caminho inverso').not.toMatch(/includes\(\s*\w+\.toLowerCase\(\)/)
    })
  }

  it('⛔⛔ a CONTAGEM não foi tocada — a busca filtra a VITRINE, nada mais', () => {
    /**
     * ⭐ A régua do dono: *"a contagem em si NÃO é tocada — contar, salvar e revisar ficam
     * intactos"*. O que o teste afirma é que nenhuma das duas telas chama a porta de busca
     * dentro de um caminho de ESCRITA: ela só decide o que aparece na lista.
     */
    for (const rel of TELAS) {
      const s = semComentarios(readFileSync(join(process.cwd(), rel), 'utf8'))
      /** ⭐ toda chamada da porta mora no cálculo do que a tela DESENHA (`visiveis`) */
      for (const m of s.matchAll(/casaBusca\(/g)) {
        const bloco = s.slice(Math.max(0, m.index - 260), m.index)
        expect(bloco, `${rel}: a busca só decide o que a tela MOSTRA`).toMatch(
          /const\s+visiveis\s*=/,
        )
      }
      // ⛔ e ela não pode encostar em gravação
      expect(s).not.toMatch(/casaBusca[\s\S]{0,160}(fetch\(|method:\s*'P)/)
    }
  })
})
