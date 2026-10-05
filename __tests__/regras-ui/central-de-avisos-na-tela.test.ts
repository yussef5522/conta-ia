/**
 * ⭐⭐ ONDE O AVISO APARECE — guard estrutural (04/10/2026).
 *
 * **Pedido do dono:** *"sininho GLOBAL no topo de TODAS as telas"* · *"bloco fino entre os
 * cartões e as listas"* · *"na home de PRODUÇÃO só avisos de produção; **financeiro NUNCA
 * aparece na produção (lei)**"* · *"estoque e financeiro ganham o bloco depois, **mesmo
 * componente**"*.
 *
 * ⚠️ Assumido como ESTRUTURAL: o projeto roda em `environment: node`, sem jsdom — não dá pra
 * clicar. O que ele trava é a FORMA que já custou caro nesta casa (porta sem maçaneta, 2ª
 * composição por viewport, tela decidindo regra de permissão).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const HOME = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const BLOCO = 'components/avisos/bloco-do-setor.tsx'
const SINO = 'components/avisos/sininho.tsx'

describe('⭐⭐ o sininho é GLOBAL — e nos DOIS viewports (REGRA 12)', () => {
  it('⭐ TopBar (desktop) e header do celular usam o MESMO componente', () => {
    expect(ler('components/layout/top-bar.tsx')).toMatch(/<Sininho\s*\/>/)
    expect(ler('components/layout/dashboard-shell.tsx')).toMatch(/<Sininho\s*\/>/)
  })

  /**
   * ⛔⛔ A ORDEM do pedido: *"entre o sininho e a ação primária da tela"* — o 🌙/☀️ fica DEPOIS
   * do sininho. Não é estética: o dono vai procurar o sininho no mesmo lugar nas duas barras.
   */
  it('⭐ a ordem é sininho → 🌙/☀️ → usuário, nas duas barras', () => {
    for (const f of ['components/layout/top-bar.tsx', 'components/layout/dashboard-shell.tsx']) {
      const s = ler(f)
      expect(s.indexOf('<Sininho'), `${f}: sininho antes do tema`).toBeLessThan(s.indexOf('<BotaoTema'))
    }
  })

  /**
   * ⛔⛔ A EMPRESA VEM DO `useEmpresa()`. É a cicatriz de 20/09 inteira: a Lixeira lia
   * `current_empresa_id` por `document.cookie`, o cookie é **httpOnly**, e o resultado foi
   * *"carregando…" PARA SEMPRE* com a rota respondendo 200 em 104 ms.
   */
  it('⛔⛔ o sininho NÃO lê cookie no cliente — usa a porta única `useEmpresa`', () => {
    const s = semComentario(ler(SINO))
    expect(s, 'cookie httpOnly é invisível pro cliente').not.toMatch(/document\.cookie/)
    expect(s).toMatch(/useEmpresa\(\)/)
  })

  /** ⛔ estado EXPLÍCITO: "ainda não sei a empresa" ≠ "não tem aviso" ≠ "falhou" */
  it('⛔ os 4 estados existem, e a falha oferece "tentar de novo"', () => {
    const s = ler(SINO)
    for (const e of ['CARREGANDO', 'SEM_EMPRESA', 'FALHOU', 'OK']) expect(s).toContain(`'${e}'`)
    expect(s).toMatch(/tentar de novo/)
    expect(s, 'teto de tempo: spinner eterno não existe').toMatch(/fetchComTimeout/)
  })

  /** ⚠️ badge zerado treina o dono a não olhar (a lição do card de dupla contagem, 10/09) */
  it('⭐ o contador só aparece com número', () => {
    expect(semComentario(ler(SINO))).toMatch(/naoLidos > 0 &&/)
  })
})

describe('⛔⛔⛔ A LEI na tela: a home de produção pede PRODUÇÃO, e só', () => {
  /**
   * ⚠️⚠️ **INVERTIDO em 04/10 com o motivo escrito, não apagado** — e o que mudou foi a CASA,
   * nunca a lei. Ordem do dono, ~2h depois de o bloco subir: *"o bloco inline MORRE — avisos só
   * no sininho do topo. **Nada de aviso inline em tela nenhuma sem o dono pedir.**"*
   *
   * ⭐ A LEI (*"financeiro NUNCA aparece na produção"*) continua de pé e continua sendo aplicada
   * no MESMO lugar de antes: o `where` da rota (os dois testes abaixo). O que este caso
   * afirmava — *"a home monta o bloco com `setor` cravado"* — descrevia a 2ª vitrine do mesmo
   * dado, que é justamente o que saiu. Quem guarda a ausência em detalhe é
   * `avisos-so-no-sininho.test.ts`.
   */
  it('⛔⛔ a home NÃO monta bloco inline — e a lei segue no servidor', () => {
    const s = semComentario(ler(HOME))
    expect(s, 'aviso inline na tela de trabalho morreu por decisão do dono').not.toMatch(/<BlocoDeAvisos/)
    // ⭐ e a capacidade continua TIPADA por setor (o componente guardado não virou genérico)
    expect(semComentario(ler(BLOCO))).toMatch(/setor \}: \{ empresaId: string; setor: Setor \}/)
  })

  /**
   * ⛔⛔ O setor NÃO pode vir da URL nem de estado da tela: `?setor=financeiro` numa tela de
   * produção seria a lei do dono virando combinado. A tela recebe por PROP e não tem como
   * pedir outro.
   */
  it('⛔⛔ o setor nunca sai de query/estado — é prop', () => {
    const s = semComentario(ler(BLOCO))
    expect(s, 'o bloco não lê a URL').not.toMatch(/useSearchParams|searchParams/)
    expect(s, 'nem guarda setor em estado').not.toMatch(/useState<Setor>|setSetor/)
    expect(s).toMatch(/setor \}: \{ empresaId: string; setor: Setor \}/)
  })

  /**
   * ⛔⛔ E A LEI É APLICADA NO SERVIDOR. Se só a tela filtrasse, a rota teria mandado o dado —
   * e a próxima tela nova decidiria de novo (uma delas decidiria errado).
   */
  it('⛔⛔ a rota filtra por SETOR e por PERMISSÃO, no servidor', () => {
    const s = semComentario(ler('app/api/empresas/[id]/avisos/route.ts'))
    expect(s, 'a permissão decide os setores visíveis').toMatch(/setoresVisiveis\(ctx\.permissions\)/)
    expect(s, 'e pedir setor sem permissão leva 403').toMatch(/permitidos\.includes\(pedido\)/)
    expect(s).toMatch(/status: 403/)
  })

  /** ⭐ um componente, três telas — dois blocos "quase iguais" divergem na 1ª frase ajustada */
  it('⭐ o bloco é um componente só, reusável por setor', () => {
    expect(existsSync(join(RAIZ, BLOCO))).toBe(true)
    const s = ler(BLOCO)
    expect(s).toMatch(/export function BlocoDeAvisos/)
    // ⛔ e não existe um segundo bloco "de produção"
    expect(existsSync(join(RAIZ, 'components/avisos/bloco-de-producao.tsx'))).toBe(false)
  })
})

describe('⛔ o bloco SOME quando zera — mas falha NÃO é zero', () => {
  it('⭐ lista vazia não desenha nada', () => {
    const s = semComentario(ler(BLOCO))
    expect(s).toMatch(/avisos\.length === 0\) return null/)
  })

  /**
   * ⛔⛔ *"Erro disfarçado de vazio"* é a doença que esta casa já pagou com *"ninguém da cozinha
   * cadastrado"* (09/09) e com *"Tudo conciliado ✓"* em cima de 16 pagamentos (10/09).
   */
  it('⛔⛔ carregamento que FALHA mostra o motivo e o "tentar de novo"', () => {
    const s = semComentario(ler(BLOCO))
    const falhou = s.slice(s.indexOf("estado === 'FALHOU'"))
    expect(falhou).toMatch(/tentar de novo/)
    expect(falhou).toMatch(/\{erro\}/)
  })

  /** ⛔⛔ "O que fazer" aparece SEMPRE — é o que separa aviso de ruído */
  it('⛔⛔ as duas superfícies mostram o "o que fazer"', () => {
    expect(ler(BLOCO)).toMatch(/a\.oQueFazer/)
    expect(ler(SINO)).toMatch(/O que fazer:/)
  })

  /** ⭐ "ver todos" abre NO LUGAR — não expulsa o dono da tela onde o trabalho está (14/09) */
  it('⭐ "ver todos" não navega pra outra página', () => {
    const s = semComentario(ler(BLOCO))
    expect(s).toMatch(/ver todos \(\$\{avisos\.length\}\)/)
    expect(s, 'o "ver todos" é botão de expandir, não link').toMatch(/onClick=\{\(\) => setTudo/)
  })
})

describe('⛔ o produtor é a MESMA função do cron e da primeira carga', () => {
  /**
   * ⛔⛔ Um script de carga com texto próprio criaria DUAS verdades (a frase de hoje e a de
   * amanhã), e elas divergiriam no 1º ajuste — a doença dos 7 detectores de par em forma de
   * texto de alarme.
   */
  it('⭐⭐ a primeira carga chama `produzirAvisosDeProducao`, não reimplementa frase', () => {
    const s = ler('scripts/primeira-carga-avisos.ts')
    expect(s).toMatch(/rodarProdutoresDeAviso|produzirAvisosDeProducao/)
    expect(s, 'o script não escreve título de aviso na mão').not.toMatch(/titulo:\s*['"`]/)
  })

  it('⭐ e o juiz das 3h roda os produtores (o canal novo, com o e-mail de cópia)', () => {
    const s = semComentario(ler('scripts/cron-judge.ts'))
    expect(s).toMatch(/rodarProdutoresDeAviso\(\)/)
    expect(s, 'o e-mail continua — aviso é canal novo, não substituto').toMatch(/ALERT_TO|sendAlert|email/i)
  })

  /** ⛔ gravação SÓ pela porta única: produtor que grava direto fura a lei da língua */
  it('⛔⛔ nenhum produtor escreve em `prisma.aviso.create` por fora da central', () => {
    for (const f of ['lib/avisos/produtores/producao.ts', 'lib/avisos/produtores/rodar.ts', 'scripts/primeira-carga-avisos.ts']) {
      const s = semComentario(ler(f))
      expect(s, `${f} tem que passar por registrarAviso`).not.toMatch(/prisma\.aviso\.(create|update|upsert)/)
    }
  })
})
