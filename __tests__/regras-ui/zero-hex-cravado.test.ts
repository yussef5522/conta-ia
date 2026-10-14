/**
 * ⭐⭐⭐ ZERO HEX CRAVADO — A CATRACA DO SISTEMA TODO (14/10/2026).
 *
 * **Ordem do dono, FRENTE A da fundação:** *"Os tokens da referência viram a ÚNICA fonte de
 * cor/tinta/linha/sombra/raio do sistema, nos 2 temas (…) zero hex cravado em tela (o guard que
 * já existe passa a vigiar o sistema todo)."*
 *
 * ⚠️⚠️ E O TAMANHO FOI MEDIDO ANTES DE PROMETER: **113 dos 517 `.tsx` de `app/` + `components/`
 * têm hex de cor cravado** (86 no dashboard, 15 no admin, 6 na landing, 6 no auth). Converter
 * os 113 num sprint de fundação seria trocar o risco de cor por um risco de regressão em 113
 * telas — e **o brief do dono já põe *"telas antigas fora do padrão"* na FASE 2, com as palavras
 * dele**. Então a cláusula se cumpre do jeito honesto:
 *
 *   1. ⭐ as SUPERFÍCIES DA FUNDAÇÃO (trilho, topo, shell) ficam em **ZERO**, hoje e pra sempre;
 *   2. ⭐ a dívida de hoje é **CONGELADA numa lista**, arquivo por arquivo;
 *   3. ⛔ **hex novo em arquivo FORA da lista = vermelho** — o sistema todo passa a ser vigiado;
 *   4. ⛔ **a lista só ENCOLHE**: arquivo convertido que fica na lista também fica vermelho, pra
 *      a dívida declarada nunca ser maior que a real (dívida inflada é dívida que ninguém ataca).
 *
 * ⭐ É a mesma forma do `zero `increment` de saldo` (30/09) e do guard de isolamento das
 * migrations: a lista nasce com o passado, e o presente nasce limpo.
 *
 * ⚠️ O DETECTOR TEM UM DONO SÓ (`hexCravados`, em `_leitura-de-fonte.ts`). Até hoje cada guard
 * de tela escrevia o próprio regex de hex — e ***N cópias do mesmo detector divergem, e a que
 * diverge é sempre a que ninguém reconsertou*** (foi assim que o `semComentarios` cegou TODO
 * guard de uma vez em 08/10).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexCravados, telasDoApp } from './_leitura-de-fonte'

const RAIZ = process.cwd()

/**
 * ⚠️ A VARREDURA MUDOU DE CASA EM 14/10 (era uma função local aqui): a varredura WCAG da
 * fundação precisa do MESMO universo, e duas cópias do mesmo detector é como uma das duas
 * fica cega. Agora o dono é `_leitura-de-fonte`, e os dois guards consomem ele.
 */
const TELAS = telasDoApp(RAIZ)

/**
 * ⭐⭐ AS SUPERFÍCIES DA FUNDAÇÃO — zero hex, hoje e sempre.
 *
 * ⛔ Elas NÃO podem entrar na dívida nem "por um tom só": são o trilho, o topo e o shell, ou
 * seja o que aparece em TODA tela do sistema. Um hex cravado aqui não é uma tela fora do padrão
 * — é o padrão quebrado em todas de uma vez, e nos dois temas.
 */
const SUPERFICIES_DA_FUNDACAO = [
  'components/layout/dashboard-shell.tsx',
  'components/layout/top-bar.tsx',
  'components/layout/tema-do-dashboard.tsx',
  'components/layout/botao-tema.tsx',
  'components/sidebar/global-sidebar.tsx',
  'components/sidebar/sidebar-item.tsx',
]

/**
 * ⛔ A DÍVIDA CONGELADA EM 14/10/2026 — 113 arquivos. **Esta lista só pode ENCOLHER.**
 * Converter um arquivo pra token ⇒ tirar a linha dele daqui (o teste 4 cobra).
 */
const DIVIDA_DE_HEX = new Set<string>([
  'app/(auth)/esqueci-senha/esqueci-senha-client.tsx',
  'app/(auth)/esqueci-senha/page.tsx',
  'app/(auth)/login/login-form.tsx',
  'app/(auth)/login/page.tsx',
  'app/(dashboard)/conciliacao/page.tsx',
  'app/(dashboard)/contas-a-pagar/page.tsx',
  'app/(dashboard)/dashboard/_components/CashflowMensalWidget.tsx',
  'app/(dashboard)/dashboard/_components/HeroKPIs.tsx',
  'app/(dashboard)/dashboard/_components/KPICard.tsx',
  'app/(dashboard)/dashboard/_components/Sparkline.tsx',
  'app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx',
  'app/(dashboard)/empresas/[id]/despesas/category-picker.tsx',
  'app/(dashboard)/empresas/[id]/estoque/cardapio/[chave]/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/cardapio/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/cardapio/secoes/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/certificado/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/contagem/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/contagens/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/contas-a-pagar/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/entrada-manual/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/entradas/[entradaId]/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/etiquetas/modelo/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/etiquetas/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/fichas/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/impressao/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/itens/nomes/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/itens/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/movimentos/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/perdas/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/posicao/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/conclusoes/[conclusaoId]/etiqueta/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/pessoas/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/receitas/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/producao/relatorios/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/radar/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/real-vs-teorico/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/recebimentos/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/recibos/[conferenceId]/page.tsx',
  'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx',
  'app/(dashboard)/empresas/[id]/relatorios/categorias/categorias-client.tsx',
  'app/(dashboard)/empresas/[id]/relatorios/page.tsx',
  'app/(dashboard)/empresas/[id]/socios/[socioId]/socio-detail-client.tsx',
  'app/(dashboard)/empresas/[id]/usuarios/convidar-usuario-modal.tsx',
  'app/(dashboard)/empresas/[id]/usuarios/link-convite-modal.tsx',
  'app/(dashboard)/empresas/[id]/usuarios/usuarios-client.tsx',
  'app/(dashboard)/perfis/[id]/_components/MonthlyEvolutionChartInner.tsx',
  'app/(dashboard)/perfis/[id]/_components/PFHero.tsx',
  'app/(dashboard)/perfis/[id]/_components/PFTopExpenses.tsx',
  'app/(dashboard)/perfis/[id]/_components/PFTopExpensesDonut.tsx',
  'app/(dashboard)/perfis/[id]/categorias/page.tsx',
  'app/(dashboard)/perfis/[id]/contas/page.tsx',
  'app/(dashboard)/perfis/[id]/despesas/despesas-pf-client.tsx',
  'app/(dashboard)/perfis/[id]/extrato/page.tsx',
  'app/(dashboard)/perfis/[id]/receitas/receitas-pf-client.tsx',
  'app/(dashboard)/pontes/[id]/page.tsx',
  'app/aceitar-convite/aceitar-convite-client.tsx',
  'app/aceitar-convite/page.tsx',
  'app/admin/clientes/[userId]/components/cliente-actions.tsx',
  'app/admin/clientes/[userId]/page.tsx',
  'app/admin/clientes/page.tsx',
  'app/admin/components/admin-sidebar.tsx',
  'app/admin/components/stat-card.tsx',
  'app/admin/cupons/[id]/coupon-actions.tsx',
  'app/admin/cupons/[id]/page.tsx',
  'app/admin/cupons/components/new-coupon-button.tsx',
  'app/admin/cupons/novo/coupon-form.tsx',
  'app/admin/cupons/novo/page.tsx',
  'app/admin/cupons/page.tsx',
  'app/admin/dashboard/page.tsx',
  'app/admin/layout.tsx',
  'app/admin/login/login-form.tsx',
  'app/admin/login/page.tsx',
  'app/cozinha/[empresaId]/page.tsx',
  'app/layout.tsx',
  /* ⭐ `components/avisos/sininho.tsx` SAIU DA LISTA EM 14/10 — a catraca andou um dente. O
     `#fff` do contador virou `--prod-trilho-on` quando o sino vestiu o chassi `.icbt` da
     referência. ⚠️ E foi o guard que cobrou a saída: ele reprova dívida MORTA justamente pra
     a lista não envelhecer dizendo que um arquivo já convertido ainda tem hex. */
  'components/categorias-pf/NovaCategoriaPFModal.tsx',
  'components/categorias/CategoryForm.tsx',
  'components/conciliacao/caixa-de-entrada.tsx',
  'components/conciliacao/chassi-do-cartao.tsx',
  'components/conciliacao/escolher-na-mao-card.tsx',
  'components/conciliacao/fila-escolher-na-mao.tsx',
  'components/conciliacao/lote-sugerido.tsx',
  'components/conciliacao/menu-do-chip.tsx',
  'components/conciliacao/stats-do-mock.tsx',
  'components/contas-pagar/PayableTable.tsx',
  'components/equipe/equipe-client.tsx',
  'components/estoque/acoes-do-gerente-hoje.tsx',
  'components/estoque/cadastrar-pessoa-modal.tsx',
  'components/estoque/conferencia-view.tsx',
  'components/estoque/contagem/cartao-contar.tsx',
  'components/estoque/contagem/revisao-contagem.tsx',
  'components/estoque/ficha-editor.tsx',
  'components/estoque/itens-manuais-editor.tsx',
  'components/estoque/placar-da-equipe.tsx',
  'components/estoque/plano-venda-modal.tsx',
  'components/estoque/redesignar-inline.tsx',
  'components/estoque/saida-modal.tsx',
  'components/landing/features.tsx',
  'components/landing/footer.tsx',
  'components/landing/hero-visual.tsx',
  'components/landing/hero.tsx',
  'components/landing/logo.tsx',
  'components/landing/whatsapp-float.tsx',
  'components/logo.tsx',
  'components/perfis/lancamento-rapido.tsx',
  'components/perfis/widgets-pf.tsx',
  'components/relatorios/HeroCard.tsx',
  'components/relatorios/HeroSparkline.tsx',
  'components/relatorios/MiniSparkline.tsx',
  'components/relatorios/analise-variacao/WaterfallChartSvg.tsx',
  'components/relatorios/fluxo-caixa/CashFlowChart.tsx',
])

describe('⭐⭐⭐ a catraca do hex cravado', () => {
  it('⭐⭐ as SUPERFÍCIES DA FUNDAÇÃO (trilho, topo, shell) têm ZERO hex cravado', () => {
    const sujas: string[] = []
    for (const p of SUPERFICIES_DA_FUNDACAO) {
      const hex = hexCravados(readFileSync(join(RAIZ, p), 'utf8'))
      if (hex.length) sujas.push(`${p}: ${[...new Set(hex)].join(' ')}`)
    }
    expect(sujas, `cor cravada na fundação sai em TODA tela: ${sujas.join(' | ')}`).toEqual([])
  })

  it('⛔ superfície da fundação NUNCA entra na dívida', () => {
    const presas = SUPERFICIES_DA_FUNDACAO.filter((p) => DIVIDA_DE_HEX.has(p))
    expect(presas, `a fundação não tem dívida de cor: ${presas.join(', ')}`).toEqual([])
  })

  /** ⛔⛔ É ESTE que faz a fundação valer pro sistema todo: tela NOVA nasce em token. */
  it('⛔⛔ nenhum arquivo FORA da dívida cravou hex de cor', () => {
    const novos: string[] = []
    for (const p of TELAS) {
      if (DIVIDA_DE_HEX.has(p)) continue
      const hex = [...new Set(hexCravados(readFileSync(join(RAIZ, p), 'utf8')))]
      if (hex.length) novos.push(`${p} → ${hex.join(' ')}`)
    }
    expect(
      novos,
      `hex cravado fora dos tokens — use os tokens da fundação:\n  ${novos.join('\n  ')}`,
    ).toEqual([])
  })

  /**
   * ⛔ A DÍVIDA SÓ ENCOLHE. Arquivo convertido que fica na lista a mantém INFLADA, e dívida
   * inflada é dívida que ninguém ataca — é a mesma razão de o `ROTAS_APOSENTADAS` e as exceções
   * nomeadas desta casa serem conferidas contra o estado real, nunca só declaradas.
   */
  it('⛔ a dívida não tem linha morta (arquivo já convertido, ou que nem existe mais)', () => {
    const mortas: string[] = []
    for (const p of [...DIVIDA_DE_HEX].sort()) {
      let src: string
      try {
        src = readFileSync(join(RAIZ, p), 'utf8')
      } catch {
        mortas.push(`${p} (arquivo não existe mais — tire da lista)`)
        continue
      }
      if (hexCravados(src).length === 0) mortas.push(`${p} (já está em token — tire da lista)`)
    }
    expect(mortas, `a dívida declarada é maior que a real:\n  ${mortas.join('\n  ')}`).toEqual([])
  })

  /**
   * ⭐ O NÚMERO SÓ DESCE, NUNCA SOBE — é essa assimetria que faz a catraca ser catraca. Cada
   * baixa fica DATADA aqui: 113 na medição de 14/10 → **112** quando o sininho virou token no
   * mesmo dia (o chassi `.icbt` da referência levou o `#fff` do contador embora).
   */
  it('⭐ a dívida de 14/10 tem o tamanho que foi medido', () => {
    expect(DIVIDA_DE_HEX.size, 'medida em 113, desceu pra 112 com o sininho em token').toBe(112)
    expect(TELAS.length, 'o universo varrido').toBeGreaterThan(400)
  })
})

/**
 * ⚠️ AUTO-TESTE DO DETECTOR (REGRA 11) — sem ele o guard passaria por CEGUEIRA, que é como três
 * guards desta casa nasceram mentindo. Ele tem que pegar a forma do defeito e **não** morder o
 * comentário que documenta o tom que saiu (o caso puro é o `dashboard-shell`, cujos 3 hex num
 * `grep` cru são a história do canvas, não CSS).
 */
describe('⚠️ o detector de hex morde o certo e só o certo', () => {
  it('⭐ pega as formas reais de cravar cor numa tela', () => {
    expect(hexCravados('<div className="bg-[#4F46E5]" />')).toEqual(['#4f46e5'])
    expect(hexCravados("style={{ color: '#fff' }}")).toEqual(['#fff'])
    expect(hexCravados('stroke="#E2544A" fill="#0A0F1E"')).toEqual(['#e2544a', '#0a0f1e'])
    expect(hexCravados('bg-[#4F46E580]')).toEqual(['#4f46e580'])
  })

  it('⛔⛔ NÃO morde comentário — o arquivo que documenta o tom não pode ser reprovado por isso', () => {
    expect(hexCravados('/* o dono pediu o slate frio #F8FAFC no claro */')).toEqual([])
    expect(hexCravados('// era #fafafa cravado')).toEqual([])
    expect(hexCravados('{/* #16151D no escuro */}')).toEqual([])
  })

  it('⛔ não morde o uso CERTO (token) nem id/âncora', () => {
    expect(hexCravados('<div className="bg-[var(--prod-bg)] text-[var(--prod-primary)]" />')).toEqual([])
    expect(hexCravados('<a href="#montador">ver</a>')).toEqual([])
    expect(hexCravados('id="rev-coca-lata"')).toEqual([])
  })
})
