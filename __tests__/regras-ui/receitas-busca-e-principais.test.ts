/**
 * ⭐⭐ A TELA DAS RECEITAS — busca, estrela e roupa v4 (12/10/2026).
 *
 * **Os vermelhos de TELA que o dono pediu:** *"escrita fora da porta única = vermelho (só a
 * ação grava a coluna) · comparação sem casaBusca (grep: toLowerCase/includes cru na tela) =
 * vermelho · produzir/duplicar sumiu ou mudou de destino = vermelho"*.
 *
 * ⚠️ É guard ESTRUTURAL e assumido como tal: o projeto roda em `environment: node`, **sem
 * jsdom** — não dá pra clicar. O que ele trava é o que QUEBRA de fato (o gesto sair da tela, a
 * régua ser copiada, a escrita nascer numa segunda porta); o comportamento mora na lib pura
 * (`lista-de-receitas.test.ts`) e no banco (`receita-principal.integration.test.ts`).
 *
 * ⚠️ Lê a tela **SEM COMENTÁRIO**: este arquivo documenta as frases que ele proíbe, e *o
 * arquivo que documenta o defeito não pode ser o que o absolve* (a cicatriz de 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { semComentarios, semImports, usosDe } from './_leitura-de-fonte'

const raiz = process.cwd()
const TELA = 'app/(dashboard)/empresas/[id]/estoque/producao/receitas/page.tsx'
const PORTA = 'lib/stock/producao/receita-principal.ts'
const ROTA = 'app/api/empresas/[id]/estoque/fichas/[fichaId]/principal/route.ts'
const REGUA = 'lib/stock/producao/lista-de-receitas.ts'

const ler = (rel: string) => readFileSync(join(raiz, rel), 'utf8')
const tela = () => semComentarios(ler(TELA))

describe('⭐⭐ A BUSCA passa pela PORTA DA CASA — nunca comparação crua na tela', () => {
  it('⛔⛔ a tela NÃO compara texto na mão (a cicatriz de 08/09: "agua" não achava "Água")', () => {
    const src = semImports(tela())
    expect(src, 'toLowerCase() na tela = régua copiada; o acento não se resolve com caixa')
      .not.toMatch(/\.toLowerCase\s*\(/)
    expect(src, 'includes() cru na tela = a 2ª régua de busca do sistema')
      .not.toMatch(/\.includes\s*\(/)
  })

  it('⭐ e a régua importa `casaBusca` em vez de reescrever a comparação', () => {
    const src = semComentarios(ler(REGUA))
    expect(src).toMatch(/import\s*\{\s*casaBusca\s*\}\s*from\s*'@\/lib\/busca-texto'/)
    expect(semImports(src), 'a régua copiou a normalização em vez de importar').not.toMatch(/normalize\(['"]NFD/)
  })

})

describe('⛔⛔ A ESTRELA — uma porta de escrita, e só ela', () => {
  /** varre `lib/` e `app/` atrás de QUALQUER escrita na tabela da estrela */
  function escritoresDaColuna(): string[] {
    const achados: string[] = []
    const varrer = (dir: string) => {
      for (const nome of readdirSync(join(raiz, dir))) {
        const rel = `${dir}/${nome}`
        if (nome === 'node_modules' || nome === '__tests__' || nome.startsWith('.')) continue
        if (statSync(join(raiz, rel)).isDirectory()) { varrer(rel); continue }
        if (!/\.tsx?$/.test(nome)) continue
        const src = semComentarios(readFileSync(join(raiz, rel), 'utf8'))
        if (/stockReceitaPrincipal\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)/.test(src)) {
          achados.push(rel)
        }
      }
    }
    varrer('lib')
    varrer('app')
    return achados.sort()
  }

  it('⭐⭐ SÓ a porta única escreve em `stock_receita_principal`', () => {
    expect(escritoresDaColuna(), 'nasceu um 2º caminho de escrita — a coluna passa a significar duas coisas')
      .toEqual([PORTA])
  })

  it('⭐ a rota é casca fina: delega pra porta e não grava por conta própria', () => {
    const src = semComentarios(ler(ROTA))
    expect(usosDe(src, 'marcarReceitaPrincipal')).toBeGreaterThan(0)
    expect(src, 'a rota tem que exigir a sessão do painel').toMatch(/guardStock\(request, companyId, 'stock\.manage'\)/)
    // ⚠️ `.strict()`: campo a mais é 400, nunca recortado em silêncio (a cicatriz de 25/09)
    expect(src).toMatch(/\.strict\(\)/)
  })

  it('⛔⛔ a porta NÃO encosta na receita: nada de versão, componente ou explosão', () => {
    const src = semComentarios(ler(PORTA))
    expect(src, 'a porta criou versão — estrela virou receita').not.toMatch(/stockFichaVersao/)
    expect(src, 'a porta mexeu em componente').not.toMatch(/stockFichaComponente/)
    expect(src, 'a porta chegou perto da explosão').not.toMatch(/explodir/i)
  })

  it('⭐ a porta resolve a ficha ESCOPADA por empresa (REGRA 8)', () => {
    const src = semComentarios(ler(PORTA))
    expect(src).toMatch(/stockFicha\.findFirst\(\{\s*where:\s*\{\s*id:\s*input\.fichaId,\s*companyId:\s*input\.companyId/)
  })

})

describe('⭐ OS GESTOS QUE JÁ EXISTIAM continuam — e nos mesmos destinos', () => {
  it('⭐ e "nova receita" + excluir seguem na tela (lei v2: excluir mora na ficha aberta, R24)', () => {
    const src = tela()
    expect(src).toContain('/estoque/producao/receitas/nova')
    expect(src).toContain('data-testid="excluir-receita"')
    // ⛔ o excluir pergunta ao SERVIDOR (OPTIONS = a prévia) e manda o que prometeu (`?prometido=`)
    expect(src).toMatch(/method: 'OPTIONS'/)
    expect(src).toMatch(/\?prometido=\$\{previa\.caso\}/)
  })
})

// ⚠️ (13/11) o describe que vivia aqui guardava a roupa da lista velha — a lei v2 (docs/producao-receitas-referencia.html)
// substituiu; o guard da tela nova mora em __tests__/regras-ui/producao-quatro-telas-lei.test.ts

// ⚠️ (13/11) o describe que vivia aqui guardava a roupa da lista velha — a lei v2 (docs/producao-receitas-referencia.html)
// substituiu; o guard da tela nova mora em __tests__/regras-ui/producao-quatro-telas-lei.test.ts
