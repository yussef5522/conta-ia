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

  it('⭐ quem decide o recorte é a LIB (a tela ecoa: não filtra, não ordena, não conta)', () => {
    const src = tela()
    expect(usosDe(src, 'montarListaDeReceitas'), 'a tela tem que CHAMAR a régua, não só importar')
      .toBeGreaterThan(0)
    // ⛔ e não pode ordenar/contar por fora — senão chip e lista voltam a poder discordar
    expect(semImports(src)).not.toMatch(/\.sort\s*\(/)
    expect(semImports(src)).not.toMatch(/localeCompare/)
  })

  it('⭐ e a régua importa `casaBusca` em vez de reescrever a comparação', () => {
    const src = semComentarios(ler(REGUA))
    expect(src).toMatch(/import\s*\{\s*casaBusca\s*\}\s*from\s*'@\/lib\/busca-texto'/)
    expect(semImports(src), 'a régua copiou a normalização em vez de importar').not.toMatch(/normalize\(['"]NFD/)
  })

  it('⭐ o campo de busca tem rótulo que NÃO SOME (o placeholder é exemplo, não nome)', () => {
    const src = tela()
    expect(src).toContain('placeholder="buscar receita…"')
    expect(src, 'campo de dado sem rótulo acessível é a cicatriz de 09/09').toMatch(/aria-label="buscar receita/)
  })

  it('⭐ o destaque sai da porta (`trechosDaBusca`), não de um regex na tela', () => {
    expect(usosDe(tela(), 'trechosDaBusca')).toBeGreaterThan(0)
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

  it('⭐ a estrela é BOTÃO de verdade, com o estado dito (teclado e leitor de tela)', () => {
    const src = tela()
    const i = src.search(/<button[^>]*onClick=\{\(\) => alternarPrincipal/)
    expect(i, 'a estrela não é um <button> com o gesto').toBeGreaterThan(-1)
    const bloco = src.slice(i, i + 700)
    expect(bloco, 'sem aria-pressed, quem usa leitor de tela não sabe se está marcada').toMatch(/aria-pressed=\{f\.principal\}/)
  })

  it('⭐⭐ e a falha REVERTE a estrela — nunca afirma um estado que o servidor não guardou', () => {
    const src = tela()
    const i = src.indexOf('if (!r.ok)')
    expect(i, 'o gesto otimista não trata a falha').toBeGreaterThan(-1)
    const bloco = src.slice(i, i + 300)
    expect(bloco, 'a estrela não volta sozinha — é a família do "salvo que mentia"').toMatch(/pinta\(f\.principal\)/)
    expect(bloco, 'a falha tem que DIZER').toMatch(/setAviso\(/)
  })

  it('⛔ e nenhum `carregar()` no gesto da estrela (refetch de 44 fichas pra 1 booleano)', () => {
    const src = tela()
    const i = src.indexOf('const alternarPrincipal')
    const bloco = src.slice(i, src.indexOf('if (fichas === undefined)'))
    expect(bloco).not.toMatch(/carregar\(\)/)
  })
})

describe('⭐ OS GESTOS QUE JÁ EXISTIAM continuam — e nos mesmos destinos', () => {
  it('⭐ PRODUZIR cria a ordem pela mesma rota e navega pra ela', () => {
    const src = tela()
    expect(src).toContain('> produzir')
    expect(src).toMatch(/\/api\/empresas\/\$\{id\}\/estoque\/producao\/ordens/)
    expect(src).toMatch(/window\.location\.href = `\/empresas\/\$\{id\}\/estoque\/producao\/\$\{j\.ordemId\}`/)
  })

  it('⭐ DUPLICAR continua levando pra nova receita com `duplicarDe`', () => {
    const src = tela()
    expect(src).toContain('> duplicar')
    expect(src).toMatch(/receitas\/nova\?duplicarDe=\$\{f\.id\}/)
  })

  it('⭐ e "Nova receita" + excluir seguem onde estavam', () => {
    const src = tela()
    expect(src).toContain('Nova receita')
    expect(src).toMatch(/<ExcluirReceita/)
  })
})

describe('⭐⭐ OS BLOCOS — rótulo vem da RÉGUA, nunca cravado na tela (12/10)', () => {
  /**
   * ⛔⛔ O dono pediu os blocos EXCLUSIVOS, e com isso *"Todas as receitas"* virou mentira — o
   * bloco de baixo passou a se chamar **"outras receitas"**. ⚠️ Rótulo cravado na tela faria a
   * régua renomear e a tela continuar prometendo o que não entrega: é o rótulo honesto de
   * 13/09 valendo pro lado do render.
   */
  it('⛔ a tela não crava NENHUM dos dois rótulos — ela desenha `b.titulo`', () => {
    const src = tela()
    expect(src, 'rótulo cravado: a régua renomeia e a tela mente').not.toContain('Todas as receitas')
    expect(src).not.toContain('outras receitas')
    expect(src, 'o título tem que vir da régua').toMatch(/\{b\.titulo\}/)
  })

  it('⭐ e o convite do bloco vazio também vem da régua (nunca um branco mudo)', () => {
    expect(tela()).toMatch(/\{b\.convite\}/)
  })
})

describe('⭐ ROUPA v4 — logo do dono único, sublinha num fôlego, LEI DE LAYOUT', () => {
  it('⭐ o logo vem do componente ÚNICO (zero mapa novo, zero desenho novo)', () => {
    const src = tela()
    expect(src).toMatch(/<LogoDaReceita nome=\{f\.nomeProduzido\} tamanho=\{38\} \/>/)
    expect(semImports(src), 'a tela traduziu nome→cor por conta própria').not.toMatch(/caraDaReceita/)
  })

  it('⭐ o custo "a definir" é ÂMBAR na sublinha — nunca cinza, nunca ausente', () => {
    const src = tela()
    /**
     * ⚠️ Âncora no USO (`f.custoADefinir` no JSX), nunca no 1º `custoADefinir` do arquivo —
     * ele é a DECLARAÇÃO da interface, 150 linhas acima. Minha 1ª versão fatiou dali e deu
     * **falso vermelho numa tela certa**: é a janela de distância que já enganou 7 guards aqui.
     */
    const i = src.indexOf('{f.custoADefinir')
    expect(i, 'o ternário do custo saiu do JSX').toBeGreaterThan(-1)
    const bloco = src.slice(i, i + 400)
    expect(bloco).toContain('custo a definir')
    expect(bloco, 'cinza se lê como "não importa" — e é justo aqui que falta um gesto do dono')
      .toMatch(/var\(--fam-ambar-mid\)/)
  })

  it('⭐⭐ LEI DE LAYOUT: teto 1440, 28px de respiro (14 no celular) e GRADE de cartões', () => {
    const src = tela()
    expect(src).toContain('max-w-[1440px]')
    expect(src).toContain('px-[28px]')
    expect(src).toContain('max-[700px]:px-[14px]')
    expect(src, 'coluna única é a "coluna estreita centrada" que o dono recusou').toMatch(/grid-cols-1[^"]*min-\[1100px\]:grid-cols-2/)
  })

  it('⛔ zero hex de cor cravado na tela (os 2 do azul legado são os botões que já existiam)', () => {
    const hex = [...tela().matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0])
    expect([...new Set(hex)].sort(), 'cor nova tem que entrar por token, pra inverter no tema escuro')
      .toEqual(['#0F4A8C', '#185FA5'])
  })
})
