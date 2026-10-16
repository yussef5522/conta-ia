// ⚠️⚠️ **O SELO DO DIA RACHADO TEM QUE ESTAR NA TELA (16/10/2026).**
//
// O caso real: o par de relatórios do mesmo dia caiu em dois dias (sabores em 15/10, produtos
// em 16/10) e **nenhum selo dizia que eram o MESMO dia**. A régua (`acharDiasRachados`) e a
// leitura (`lerCentralDeImport`) resolvem a pergunta; este guard existe pra a resposta **chegar
// ao dedo do dono**.
//
// ⛔⛔ Sem isto, o motor sobe e a tela não muda — a família que esta casa já pagou 11 vezes
// ("porta sem maçaneta"). ⭐ E ele prova **os DOIS lados**: a faixa existe na tela **e** o
// payload a alimenta — guard que só olha a TELA aprova uma faixa que nunca recebe dado.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL (o projeto roda em `environment: node`, sem jsdom). Lê a
// fonte **sem comentário** — senão o próprio texto que documenta o defeito o absolveria
// ("menção, não uso", a cicatriz que já mordeu 18 vezes aqui).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from './card-nao-nasce-escondido.test'
import { usosDe } from './_leitura-de-fonte'

const raiz = process.cwd()
const TELA = 'components/estoque/central-de-import.tsx'
const LEITURA = 'lib/stock/vendas/central-de-import.ts'
const REGUA = 'lib/stock/vendas/dia-rachado.ts'

const tela = semComentarios(readFileSync(join(raiz, TELA), 'utf-8'))
const leitura = semComentarios(readFileSync(join(raiz, LEITURA), 'utf-8'))
const regua = readFileSync(join(raiz, REGUA), 'utf-8')

describe('⚠️⚠️ o dia rachado chega na tela', () => {
  it('⭐⭐ a TELA desenha a faixa do racho (não é payload que ninguém olha)', () => {
    /**
     * ⚠️⚠️ **MEDE O `.map` QUE RENDERIZA, nunca a menção.** A 1ª versão fazia
     * `usosDe(tela, 'diasRachados')` e passou **VERDE** com a faixa arrancada — porque a
     * reposição deixou `typeof central.diasRachados[number]` na anotação de tipo. ***"Menção,
     * não uso" dentro do guard que existe pra isso.***
     */
    expect(tela, 'a faixa do racho saiu da tela').toContain('central.diasRachados.map(')
  })

  it('⭐ e a faixa carrega o GESTO: reimportar os produtos na data do vizinho', () => {
    // ⚠️ o bloco do racho, não o do buraco — fatiado pelo `key` próprio dele
    const i = tela.indexOf('racho-')
    expect(i, 'o bloco do racho não existe na tela').toBeGreaterThan(0)
    const bloco = tela.slice(i, i + 1200)
    expect(bloco, 'faixa sem saída é aviso, não ferramenta').toContain("onImportar('PRODUTOS'")
    expect(bloco).toContain('r.vizinho')
  })

  it('⭐ a linha do dia carrega o LOCALIZADOR (pra não caçar numa lista de 31)', () => {
    expect(usosDe(tela, 'd.rachado')).toBeGreaterThan(0)
  })

  it('⛔ a LEITURA alimenta os dois: o par no topo e o selo na linha', () => {
    expect(usosDe(leitura, 'acharDiasRachados'), 'a régua não é consumida').toBeGreaterThan(0)
    expect(usosDe(leitura, 'rachoPorDia')).toBeGreaterThan(0)
  })

  it('⛔⛔ a TELA não reimplementa a régua — quem acha o racho é a lib', () => {
    expect(tela).not.toContain('acharDiasRachados')
    // nenhuma aritmética de dia vizinho na tela
    expect(tela).not.toContain('86_400_000')
  })

  it('⭐ a régua é PURA — sem banco, sem relógio (o dia do par é dado, não "hoje")', () => {
    expect(regua).not.toContain('prisma')
    expect(semComentarios(regua)).not.toContain('Date.now')
    expect(semComentarios(regua)).not.toContain('new Date()')
  })
})
