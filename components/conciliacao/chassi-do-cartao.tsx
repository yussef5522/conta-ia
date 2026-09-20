'use client'

// ⭐⭐⭐ O CHASSI DO CARTÃO ≍ — UM MODELO, TODAS AS CASAS (20/09/2026).
//
// **A régua do dono:** *"uma decisão aparece UMA vez na página, SEMPRE no mesmo modelo
// visual — o cartão ≍."*
//
// ⛔⛔ **POR QUE ISTO É UM COMPONENTE E NÃO UMA CÓPIA.** A caixa desenhava o chassi no
// `CartaoDaLinha` e o "pra tua mão" tinha o seu, com visual próprio — o dono via *"a mesma
// coisa duas vezes, em dois MODELOS visuais diferentes"*. Escrever o chassi de novo no card
// do N:M resolveria a queixa de hoje e **divergiria no primeiro ajuste de tom**: é a mesma
// doença que esta casa paga desde os 7 detectores de par. ***Quando N telas precisam do
// MESMO desenho, o desenho vira componente.***
//
// ⚠️ **ELE É SÓ O CHASSI.** O que cada casa põe do lado direito é problema dela — palpite,
// painel do caso, chips, ou o card de escolher-na-mão inteiro. O chassi garante que o lado
// ESQUERDO (o fato bruto do banco) e o conector sejam idênticos em todas.

import type { ReactNode } from 'react'
import { V3, SOMBRA, CONECTOR } from './mock-v3-tokens'

/** o fato bruto — o que o banco diz, igual em qualquer casa */
export interface BancoDiz {
  conta: string | null
  descricao: string
  /** YYYY-MM-DD */
  data: string
  contraparte?: string | null
  valor: number
  credito: boolean
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string) => d.split('-').reverse().join('/')

export function ChassiDoCartao({
  banco, abaixoDoValor, children, id, moldura = true, painelColado = false,
}: {
  banco: BancoDiz
  /** ⭐ o que cada casa acrescenta na coluna da esquerda (a caixa põe a categoria ali) */
  abaixoDoValor?: ReactNode
  /** o painel da direita — o que muda entre as casas */
  children: ReactNode
  id?: string
  /**
   * ⚠️ **A MOLDURA É DE QUEM JÁ TEM UMA** (20/09). O caso N:M mora DENTRO do cartão do
   * fornecedor (que já desenha borda/raio/sombra), então lá o chassi entra sem a própria:
   * caixa dentro de caixa é ruído, e a régua do dono é *"o mesmo MODELO visual"*, não
   * *"mais uma borda"*. ⛔ O que NÃO muda com isto é o desenho: grid, coluna do banco e
   * conector continuam idênticos — é o que impede as casas de divergirem.
   */
  moldura?: boolean
  /**
   * ⭐ o painel da direita cola nas bordas (`p-0`) quando o conteúdo é uma LISTA que sangra
   * — as notas do caso N:M têm linha divisória de ponta a ponta e rodapé sticky; com o
   * padrão do chassi elas ganhariam uma margem que quebra as duas coisas.
   */
  painelColado?: boolean
}) {
  return (
    <div
      id={id}
      className={moldura ? 'overflow-hidden rounded-[22px] border' : ''}
      style={moldura
        ? { background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }
        : { background: V3.card }}
    >
      {/*
        ⭐ REGRA 12 — o mock manda: desktop lado a lado (1fr 64px 1fr), celular EMPILHA.
        A media query do mock é 900px; aqui é a variante arbitrária do Tailwind, pra a
        medida sair do MESMO número que o guard lê no arquivo.
      */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_64px_1fr]">
        {/* ── O BANCO DIZ ─────────────────────────────────────────────── */}
        <div className="px-5 py-[18px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            O BANCO DIZ
            {banco.conta && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                style={{ background: '#f2f1f8', color: V3.ink }}>
                <i className="h-4 w-4 rounded-full not-italic" style={{ background: 'linear-gradient(135deg,#7ac142,#4a8f2a)' }} />
                {banco.conta}
              </span>
            )}
          </div>
          <div className="text-[14.5px] font-bold leading-[1.35]" style={{ color: V3.ink }}>
            {banco.descricao || '(sem descrição)'}
            <small className="mt-0.5 block text-[12px] font-medium" style={{ color: V3.sub }}>
              {dia(banco.data)}{banco.contraparte ? ` · ${banco.contraparte}` : ''}
            </small>
          </div>
          {/* ⭐ o valor GIGANTE — coral débito, verde crédito */}
          <div className="mt-2 text-[28px] font-extrabold tracking-[-0.01em] tabular-nums"
            style={{ color: banco.credito ? V3.verde : V3.coral }}>
            {banco.credito ? '+' : '−'} {brl(banco.valor)}
          </div>
          {abaixoDoValor}
        </div>

        {/* ── O CONECTOR ──────────────────────────────────────────────── */}
        <div className="flex flex-row items-center justify-center gap-1.5 px-4 pb-1 min-[900px]:flex-col min-[900px]:px-0 min-[900px]:py-3">
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: V3.roxoBg, color: V3.roxo }}>{CONECTOR}</div>
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
        </div>

        {/* ── O PAINEL DA CASA ────────────────────────────────────────── */}
        <div className={painelColado ? '' : 'px-5 py-[18px]'}>{children}</div>
      </div>
    </div>
  )
}
