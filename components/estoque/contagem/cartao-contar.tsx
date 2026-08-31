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

import { useEffect, useRef, useState } from 'react'
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

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dataCurta = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** ⚠️ UN não aceita fração — o back RECUSA, e a tela avisa antes de o dedo bater no botão */
const ehInteira = (u: string) => /^(UN|UND|PC|PCT|CX|DZ|PAR)$/i.test(u)

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

  const valor = Number(texto.replace(/\./g, '').replace(',', '.'))
  const valido = texto.trim() !== '' && Number.isFinite(valor) && valor >= 0 &&
    (!ehInteira(linha.unidadeControle) || Number.isInteger(valor))
  const fracaoProibida = texto.trim() !== '' && Number.isFinite(valor) && ehInteira(linha.unidadeControle) && !Number.isInteger(valor)

  const confirmar = () => {
    if (!valido || salvando) return
    onConfirmar(valor, { viuSistema: revelado, observacao: obs.trim() || null })
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      {/* progresso SEMPRE visível — era "0/91" repetido duas vezes e nenhuma proeminente */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-slate-700">{posicao} de {total}</span>
          <span className="text-[11px] text-slate-400">{linha.categoriaLabel}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#185FA5] transition-all" style={{ width: `${(posicao / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      {/* ⭐ o NOME é a maior coisa da tela: o que é grande, qual é pequeno */}
      <div>
        <h2 className="text-[26px] font-bold leading-tight text-slate-900 sm:text-[30px]">{linha.titulo}</h2>
        {linha.especificacao && (
          <p className="mt-0.5 text-[15px] leading-snug text-slate-500">{linha.especificacao}</p>
        )}
        <p className="mt-1.5 text-[11px] text-slate-400">
          {linha.ultimaContagemEm
            ? <>contado em {dataCurta(linha.ultimaContagemEm)}{linha.ultimaContagemPor ? ` por ${linha.ultimaContagemPor}` : ''}</>
            : 'nunca contado'}
        </p>
      </div>

      {/* ⚠️ o aviso da unidade suspeita: a divergência aqui pode ser do CADASTRO */}
      {linha.avisoUnidade && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {linha.avisoUnidade}
        </p>
      )}

      {/* ⭐ campo GRANDE com a unidade COLADA — era do outro lado da tela */}
      <div>
        <div className={`flex items-stretch overflow-hidden rounded-xl border-2 ${fracaoProibida ? 'border-rose-400' : 'border-slate-300 focus-within:border-[#185FA5]'}`}>
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
            className="min-w-0 flex-1 bg-transparent px-4 py-5 text-center text-[40px] font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-200"
          />
          <span className="flex items-center bg-slate-50 px-4 text-[15px] font-semibold text-slate-500">
            {linha.unidadeControle}
          </span>
        </div>
        {fracaoProibida && (
          <p className="mt-1 text-[11px] text-rose-600">
            {linha.unidadeControle} se conta inteiro. Se você usa meia unidade, o item precisa ser cadastrado numa unidade menor.
          </p>
        )}
      </div>

      {/* ⭐⭐ CONTAGEM CEGA: revelar é escolha, e fica registrado */}
      {!revelado ? (
        <button type="button" onClick={() => setRevelado(true)}
          className="inline-flex items-center justify-center gap-1.5 self-center text-[12px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline">
          <Eye className="h-3.5 w-3.5" /> ver o que o sistema diz
        </button>
      ) : (
        <p className="flex items-center justify-center gap-1.5 self-center rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] text-slate-600">
          <EyeOff className="h-3.5 w-3.5" />
          sistema: <b className="tabular-nums">{num(linha.saldoSistema)} {linha.unidadeControle}</b>
          <span className="text-slate-400">— fica registrado que você viu</span>
        </p>
      )}

      {/* ⭐ a observação de quem VIU — não é decisão, é o que faz o dono investigar certo */}
      {obsAberta ? (
        <textarea
          value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={300}
          placeholder="o que você viu: “estava molhado”, “achei em dois lugares”, “caixa aberta”"
          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-[13px]"
        />
      ) : (
        <button type="button" onClick={() => setObsAberta(true)}
          className="inline-flex items-center gap-1 self-center text-[12px] text-slate-400 hover:text-slate-600">
          <MessageSquarePlus className="h-3.5 w-3.5" /> anotar alguma coisa sobre este item
        </button>
      )}

      {/* botões na zona do polegar */}
      <div className="space-y-2">
        <button type="button" onClick={confirmar} disabled={!valido || salvando}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#185FA5] text-[16px] font-semibold text-white hover:bg-[#0F4A8C] disabled:bg-slate-200 disabled:text-slate-400">
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Confirmar
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => onMarcar('NAO_SEI', obs.trim() || null)} disabled={salvando}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <HelpCircle className="h-4 w-4" /> não sei
          </button>
          <button type="button" onClick={onPular} disabled={salvando}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            pular <SkipForward className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400">
          “não sei” fica registrado como <b>a apurar</b> — não vira zero nem some do relatório
        </p>
      </div>
    </div>
  )
}
