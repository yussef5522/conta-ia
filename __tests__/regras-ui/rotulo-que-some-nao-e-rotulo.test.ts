// ⛔⛔⛔ RÓTULO QUE SOME NÃO É RÓTULO (09/09/2026) — regra do dono, vale em TODA tela.
//
// **O dono:** *"o primeiro NÃO TEM RÓTULO (chutei '1' sem saber o que era)"* — e depois, ao
// saber a causa: *"conserta em TODA tela que fizer isso, independente de qual era a minha —
// rótulo que some quando eu digito é rótulo que não existe. Rótulo fixo em cima do campo,
// placeholder só de exemplo."*
//
// **A TELA ERA:** o **mobile** do "digitar os itens do DANFE" (nota que chegou sem XML) —
// três caixas embaixo do nome do produto (`qtd` · `un` · `preço`) **com o rótulo só no
// placeholder** e **sem total de linha**. ⚠️ O DESKTOP da mesma tela estava certo o tempo
// todo (`<th>` por coluna + coluna Total): o defeito era só no caminho que ele usa de fato.
//
// ⭐ **A VARREDURA (o que ele pediu) achou 11 campos assim** nas telas de estoque/equipe —
// incluindo a **porta da impressora, que não tinha NEM placeholder** (caixa completamente
// muda). Todos corrigidos; este guard impede o 12º.
//
// ⚠️ **DUAS EXCEÇÕES DELIBERADAS, e as duas têm rótulo que NÃO some:**
//  1. **célula de tabela** — o `<th>` da coluna é o rótulo, e ele fica lá enquanto se digita;
//  2. **campo de BUSCA** — ali o placeholder é o próprio propósito ("buscar no estoque…"),
//     não o nome de um dado que vai ser gravado.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()

function telas(dir: string): string[] {
  const out: string[] = []
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next' || f.startsWith('.')) continue
    const p = join(dir, f)
    if (statSync(p).isDirectory()) out.push(...telas(p))
    else if (f.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** o elemento `<input …/>` inteiro — ele costuma abrir numa linha e fechar 3 abaixo */
function elementoDaLinha(linhas: string[], i: number): string {
  return linhas.slice(i, i + 8).join(' ').split('/>')[0]
}

/** o campo está DENTRO de um `<label>`? (o rótulo é o texto do label, e ele não some) */
function dentroDeLabel(linhas: string[], i: number): boolean {
  for (let k = i; k >= 0 && k > i - 40; k--) {
    if (/<\/label>/.test(linhas[k])) return false
    if (/<label\b/.test(linhas[k])) return true
  }
  return false
}

/** campos de dado cujo único nome é o placeholder — o defeito */
function semRotuloFixo(arquivo: string): { linha: number; placeholder: string }[] {
  const linhas = readFileSync(arquivo, 'utf-8').split('\n')
  const out: { linha: number; placeholder: string }[] = []
  linhas.forEach((ln, i) => {
    if (!/<input\b/.test(ln)) return
    if (/type="(checkbox|radio|file|hidden)"/.test(ln)) return
    // ⚠️ exceção 1: célula de tabela — o <th> da coluna é o rótulo, e ele NÃO some.
    // (o `<td>` costuma abrir na linha de cima, por isso a janela de 2)
    if (/<td\b/.test(linhas.slice(Math.max(0, i - 2), i + 1).join(' '))) return
    // ⚠️ exceção 2: campo de BUSCA — ali o placeholder é o propósito, não o nome de um dado
    if (/busca/i.test(arquivo) || /busca/i.test(ln)) return
    if (/placeholder="(buscar|pesquisar|procurar|filtrar)/i.test(elementoDaLinha(linhas, i))) return
    // ⚠️ exceção 3: campo EMBRULHADO num <label> — o rótulo é o texto do próprio label,
    // e ele fica na tela enquanto se digita. Procura o <label> aberto acima, sem </label>
    // no meio (é estrutura, não distância — o label pode abrir 20 linhas acima).
    if (dentroDeLabel(linhas, i)) return
    // ⚠️ olha o ELEMENTO inteiro, senão um `aria-label` na linha seguinte passa
    // despercebido (foi o que aconteceu com o fator da conferência ao escrever isto).
    const elemento = elementoDaLinha(linhas, i)
    if (!/placeholder=/.test(elemento)) return
    // ⭐ o rótulo tem que estar VISÍVEL perto: <label>, um <span>/<p> de texto, ou <th>.
    // ⚠️ janela de 10 porque o `<label>` que embrulha o campo abre bem acima dele.
    const ctx = linhas.slice(Math.max(0, i - 10), i + 1).join(' ') + elemento
    const temRotulo = /<label|<span className="text-|<p className="text-|<th\b|aria-label=/.test(ctx)
    if (!temRotulo) out.push({ linha: i + 1, placeholder: /placeholder="([^"]*)"/.exec(ln)?.[1] ?? '{expr}' })
  })
  return out
}

const ALVOS = [
  ...telas(join(raiz, 'components/estoque')),
  ...telas(join(raiz, 'components/equipe')),
  ...telas(join(raiz, 'app/(dashboard)/empresas')).filter((p) => /\/estoque\//.test(p)),
]

describe('⛔⛔ todo campo de dado tem rótulo que NÃO some', () => {
  it('o guard está mesmo olhando as telas (não passa por lista vazia)', () => {
    expect(ALVOS.length).toBeGreaterThan(15)
  })

  it('⛔⛔ nenhum campo do estoque/equipe tem o placeholder como único nome', () => {
    const achados = ALVOS.flatMap((p) =>
      semRotuloFixo(p).map((x) => `${p.replace(raiz + '/', '')}:${x.linha} → placeholder "${x.placeholder}"`),
    )
    expect(achados, `campo sem rótulo fixo (o dono chutou "1" por causa disso):\n${achados.join('\n')}`).toEqual([])
  })

  it('⭐⭐ a tela do caso — o mobile do DANFE — tem rótulo, exemplo e TOTAL da linha', () => {
    const src = readFileSync(join(raiz, 'components/estoque/itens-manuais-editor.tsx'), 'utf-8')
    for (const rotulo of ['Descrição, como está no papel da nota', 'Quantidade', 'Unidade', 'Preço por unidade']) {
      expect(src, `falta o rótulo "${rotulo}"`).toContain(rotulo)
    }
    // ⭐ exemplo no placeholder, não o nome do campo
    expect(src).toContain('placeholder="12"')
    expect(src).toContain('placeholder="4,50"')
    // ⭐ e o total da linha, pra conferir contra o papel ANTES de salvar
    expect(src).toContain('total da linha')
  })

  it('⭐ e a entrada manual (mobile) também', () => {
    const src = readFileSync(join(raiz, 'app/(dashboard)/empresas/[id]/estoque/entrada-manual/page.tsx'), 'utf-8')
    expect(src).toContain('Quantidade')
    expect(src).toContain('Preço por unidade')
    expect(src).toContain('Nome do produto novo')
  })

  it('⛔ a porta da impressora ganhou rótulo — ela não tinha nem placeholder', () => {
    const src = readFileSync(join(raiz, 'app/(dashboard)/empresas/[id]/estoque/impressao/page.tsx'), 'utf-8')
    expect(src).toContain('>Porta<')
    expect(src).toContain('placeholder="9100"')
  })
})
