'use client'

// ⭐⭐ MODO CONTAR — UM ITEM POR VEZ, TELA CHEIA (31/08/2026).
//
// Quem conta é a funcionária, em pé no estoque, celular na mão. A tela antiga era uma
// TABELA: nome na ponta esquerda, campo na ponta direita, unidade do outro lado, spinner
// com setinhas. O olho atravessava a tela inteira por linha — erro de linha garantido — e
// digitar 6.313 numa setinha é impossível.
//
// ⛔⛔ E O PIOR ERA MÉTODO, NÃO VISUAL: a coluna SISTEMA ficava à vista durante a contagem.
// **Quem vê "571" escreve "571"** mesmo tendo contado 560 — viés de confirmação. Contagem
// CEGA é padrão-ouro da indústria (Thrive, Square, Finale) e é a razão de a contagem
// existir. Aqui o número do sistema **não aparece**; existe um botão pra revelar, e revelar
// **fica registrado**. Não é proibição, é escolha com rastro.
//
// ⚠️ "NÃO SEI" É ESTADO DE PRIMEIRA CLASSE. Antes, branco era ambíguo: "não contei" e
// "contei e deu zero" eram a mesma coisa. É a régua da casa — **a apurar > número
// inventado** — a mesma do "sem contagem" da Posição e do "A DEFINIR" da etiqueta.

/**
 * ⭐⭐ **O UPGRADE DE TINTA (15/10)** — e este arquivo é a lição de que a tela não é só a
 * `page.tsx`. A página da contagem foi migrada pra token mais cedo hoje e **a medição do
 * CHUNK em prod acusou 5 hex do azul legado**: eles vinham daqui (4) e do `revisao-contagem`
 * (1), os dois componentes que a página desenha.
 *
 * ⛔ Deixar assim seria a tela **MIGRADA PELA METADE, e na metade pior**: a moldura invertendo
 * no tema escuro e **o cartão que a pessoa TOCA** preso no azul claro. Quem conta está de
 * celular na mão dentro da CÂMARA FRIA — o controle é justamente o que não pode deslavar.
 *
 * ⚠️ A troca é por **PAPEL** e segue a convenção do módulo **ao pé da letra** (cor por `style`
 * inline, como a `page.tsx` e a lista de Receitas fazem; primário `--prod-acao-bg/ink` **sem
 * hover**, desabilitado por `disabled:opacity-50`). ⛔ Convenção própria aqui faria o mesmo
 * botão ter dois comportamentos em duas telas do mesmo módulo.
 *
 * ⛔ **ESTRUTURA E COMPORTAMENTO INTOCADOS**: a contagem cega, o registro do "revelar", o
 * "não sei", o freio da fração e a régua do `quantidade.ts` são exatamente os mesmos.
 */

import { useEffect, useRef, useState } from 'react'
import { aceitaFracao, sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'
import { Eye, EyeOff, SkipForward, HelpCircle, Check, Loader2, AlertTriangle, MessageSquarePlus } from 'lucide-react'

export interface LinhaContar {
  itemId: string
  nome: string
  titulo: string
  especificacao: string
  categoriaLabel: string
  unidadeControle: string
  saldoSistema: number
  avisoUnidade: string | null
  ultimaContagemEm: string | null
  ultimaContagemPor: string | null
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
  contado: { qtdContada: number } | null
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const dataCurta = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** ⚠️ UN não aceita fração — o back RECUSA, e a tela avisa antes de o dedo bater no botão */

export function CartaoContar({
  linha, posicao, total, salvando, onConfirmar, onMarcar, onPular,
}: {
  linha: LinhaContar
  posicao: number
  total: number
  salvando: boolean
  onConfirmar: (qtd: number, opts: { viuSistema: boolean; observacao: string | null }) => void
  onMarcar: (estado: 'NAO_SEI', observacao: string | null) => void
  onPular: () => void
}) {
  const [texto, setTexto] = useState('')
  const [revelado, setRevelado] = useState(false)
  const [obsAberta, setObsAberta] = useState(false)
  const [obs, setObs] = useState('')
  const campo = useRef<HTMLInputElement>(null)

  // item novo = campo limpo e foco. ⚠️ REGRA 9: hooks no topo, antes de qualquer return.
  useEffect(() => {
    setTexto(linha.contado ? String(linha.contado.qtdContada).replace('.', ',') : '')
    setRevelado(false)
    setObsAberta(false)
    setObs('')
    campo.current?.focus()
  }, [linha.itemId, linha.contado])

  // ⛔⛔ A RÉGUA SAIU DAQUI (08/09). Era um `const` local — *"regra que mora num
  // componente é regra que ninguém prova"* — e divergia da do módulo `quantidade.ts`,
  // que existe desde 28/08: aqui ponto era milhar, lá ele CORTAVA o resto (`6.313` → `6`).
  // Agora as duas leem a mesma função, e a que sobreviveu foi esta (cortar perdia 6.307
  // unidades em silêncio).
  const valor = valorQtd(sanitizarQtd(texto, linha.unidadeControle)) ?? NaN
  const valido = texto.trim() !== '' && Number.isFinite(valor) && valor >= 0 &&
    (!!aceitaFracao(linha.unidadeControle) || Number.isInteger(valor))
  const fracaoProibida = texto.trim() !== '' && Number.isFinite(valor) && !aceitaFracao(linha.unidadeControle) && !Number.isInteger(valor)

  const confirmar = () => {
    if (!valido || salvando) return
    onConfirmar(valor, { viuSistema: revelado, observacao: obs.trim() || null })
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      {/* progresso SEMPRE visível — era "0/91" repetido duas vezes e nenhuma proeminente */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--prod-primary)' }}>{posicao} de {total}</span>
          <span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>{linha.categoriaLabel}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--prod-surface-2)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(posicao / Math.max(1, total)) * 100}%`, background: 'var(--prod-acao-bg)' }} />
        </div>
      </div>

      {/* ⭐ o NOME é a maior coisa da tela: o que é grande, qual é pequeno */}
      <div>
        <h2 className="text-[26px] font-bold leading-tight sm:text-[30px]" style={{ color: 'var(--prod-primary)' }}>{linha.titulo}</h2>
        {linha.especificacao && (
          <p className="mt-0.5 text-[15px] leading-snug" style={{ color: 'var(--prod-secondary)' }}>{linha.especificacao}</p>
        )}
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--prod-muted)' }}>
          {linha.ultimaContagemEm
            ? <>contado em {dataCurta(linha.ultimaContagemEm)}{linha.ultimaContagemPor ? ` por ${linha.ultimaContagemPor}` : ''}</>
            : 'nunca contado'}
        </p>
      </div>

      {/* ⚠️ o aviso da unidade suspeita: a divergência aqui pode ser do CADASTRO */}
      {linha.avisoUnidade && (
        <p className="flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] leading-snug"
          style={{ borderColor: 'var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {linha.avisoUnidade}
        </p>
      )}

      {/* ⭐ campo GRANDE com a unidade COLADA — era do outro lado da tela */}
      <div>
        {/*
          ⚠️ AQUI a cor vai por CLASSE, não por `style` inline — e é o único lugar do arquivo
          que foge da convenção, de propósito: existe um `focus-within:` em jogo, e **estilo
          inline GANHA de classe**, então um `style={{ borderColor }}` apagaria o anel de foco
          do teclado em silêncio. Acessibilidade não se perde por consistência de forma.
        */}
        <div className={`flex items-stretch overflow-hidden rounded-xl border-2 ${fracaoProibida ? 'border-[var(--fam-coral-mid)]' : 'border-[var(--prod-line-strong)] focus-within:border-[var(--prod-acao-bg)]'}`}>
          <input
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmar() }}
            // ⭐ teclado numérico no celular. NUNCA type="number": o spinner com setinhas
            // é inviável no dedo e absurdo pra digitar 6.313.
            inputMode="decimal"
            autoComplete="off"
            placeholder="—"
            aria-label={`quantidade contada de ${linha.nome}`}
            className="min-w-0 flex-1 bg-transparent px-4 py-5 text-center text-[40px] font-bold tabular-nums outline-none placeholder:text-[color:var(--prod-line-strong)]"
            style={{ color: 'var(--prod-primary)' }}
          />
          <span className="flex items-center px-4 text-[15px] font-semibold"
            style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}>
            {linha.unidadeControle}
          </span>
        </div>
        {fracaoProibida && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--fam-coral-ink)' }}>
            {linha.unidadeControle} se conta inteiro. Se você usa meia unidade, o item precisa ser cadastrado numa unidade menor.
          </p>
        )}
      </div>

      {/* ⭐⭐ CONTAGEM CEGA: revelar é escolha, e fica registrado */}
      {!revelado ? (
        <button type="button" onClick={() => setRevelado(true)}
          className="inline-flex items-center justify-center gap-1.5 self-center text-[12px] underline-offset-2 hover:underline"
          style={{ color: 'var(--prod-muted)' }}>
          <Eye className="h-3.5 w-3.5" /> ver o que o sistema diz
        </button>
      ) : (
        <p className="flex items-center justify-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-[12px]"
          style={{ background: 'var(--prod-surface-2)', color: 'var(--prod-secondary)' }}>
          <EyeOff className="h-3.5 w-3.5" />
          sistema: <b className="tabular-nums">{num(linha.saldoSistema)} {linha.unidadeControle}</b>
          <span style={{ color: 'var(--prod-muted)' }}>— fica registrado que você viu</span>
        </p>
      )}

      {/* ⭐ a observação de quem VIU — não é decisão, é o que faz o dono investigar certo */}
      {obsAberta ? (
        <textarea
          value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={300}
          placeholder="o que você viu: “estava molhado”, “achei em dois lugares”, “caixa aberta”"
          className="w-full rounded-lg border px-2.5 py-2 text-[13px]"
          style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
        />
      ) : (
        <button type="button" onClick={() => setObsAberta(true)}
          className="inline-flex items-center gap-1 self-center text-[12px]" style={{ color: 'var(--prod-muted)' }}>
          <MessageSquarePlus className="h-3.5 w-3.5" /> anotar alguma coisa sobre este item
        </button>
      )}

      {/* botões na zona do polegar */}
      <div className="space-y-2">
        <button type="button" onClick={confirmar} disabled={!valido || salvando}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Confirmar
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => onMarcar('NAO_SEI', obs.trim() || null)} disabled={salvando}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[13px] hover:bg-[var(--prod-surface-1)] disabled:opacity-40"
            style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
            <HelpCircle className="h-4 w-4" /> não sei
          </button>
          <button type="button" onClick={onPular} disabled={salvando}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[13px] hover:bg-[var(--prod-surface-1)] disabled:opacity-40"
            style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
            pular <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px]" style={{ color: 'var(--prod-muted)' }}>
          “não sei” fica registrado como <b>a apurar</b> — não vira zero nem some do relatório
        </p>
      </div>
    </div>
  )
}
