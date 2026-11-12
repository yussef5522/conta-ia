'use client'

// ⭐ FICHA NA LINHA (lei Lucro por Setor v11, S13/S22) — abrir, ajustar e CRIAR a ficha ali mesmo.
//
// ⛔⛔ NÃO É UM SEGUNDO EDITOR: grava SÓ pela porta única do editor de fichas
//    (POST /estoque/fichas · PATCH /estoque/fichas/[id]) — as mesmas validações, o mesmo vínculo
//    nome do PDV → ficha na mesma transação, a mesma versão nova a cada gravação. O corpo sai de
//    `lib/lucro-setor/ficha-na-linha.ts` (puro, testado contra `criarFicha`/`atualizarFicha`).
//    O catálogo é o `BuscaItem` de sempre, no universo da RECEITA (o mesmo do editor).
// ⛔ S22 · ficha vazia não grava (custo zero não é custo): enquanto vazia, a linha segue "sem ficha".
// ⭐ Cascata: gravou → `aoGravar()` → a tela relê o dia → ficha → item → setor → estudo.

import { useEffect, useMemo, useState } from 'react'
import { BuscaItem, type ItemBusca } from './busca-item'
import { formatBRL } from '@/lib/format/money'
import { formatarQtd, valorQtd, textoQtd } from '@/lib/stock/quantidade'
import { corpoDaCriacao, corpoDaEdicao, rodapeDaFicha, moverDose, recusa, type CompNaLinha } from '@/lib/lucro-setor/ficha-na-linha'

export interface AlvoDaFicha {
  fichaId: string | null
  tipo: 'PRODUTO' | 'SABOR'
  nome: string
  nomesPdv: string[]
  preco: number | null
}

export function FichaNaLinha({ companyId, alvo, aoGravar }: { companyId: string; alvo: AlvoDaFicha; aoGravar: () => void }) {
  const [comps, setComps] = useState<CompNaLinha[] | null>(alvo.fichaId ? null : [])
  const [inicial, setInicial] = useState<string>('[]')
  const [busca, setBusca] = useState(!alvo.fichaId)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  /** ⭐ (12/11) dose fora da família: a porta pergunta, a linha confirma */
  const [doseAConfirmar, setDoseAConfirmar] = useState(false)

  useEffect(() => {
    if (!alvo.fichaId) return
    let vivo = true
    fetch(`/api/empresas/${companyId}/estoque/fichas/${alvo.fichaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ficha'))))
      .then((j: { ficha: { componentes: { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null }[] } }) => {
        if (!vivo) return
        const cs = j.ficha.componentes.map((c) => ({ itemId: c.itemId, nome: c.nome, unidade: c.unidade, qtdTexto: textoQtd(c.qtdPlanejada), custoMedio: c.custoMedio }))
        setComps(cs)
        setInicial(JSON.stringify(cs))
        if (!cs.length) setBusca(true)
      })
      .catch(() => vivo && setErro('Não consegui abrir a ficha.'))
    return () => { vivo = false }
  }, [companyId, alvo.fichaId])

  const rodape = useMemo(() => (comps ? rodapeDaFicha(comps, formatBRL) : ''), [comps])
  const mudou = comps != null && JSON.stringify(comps) !== inicial

  const add = (it: ItemBusca) => setComps((cs) => (cs && !cs.some((c) => c.itemId === it.id) ? [...cs, { itemId: it.id, nome: it.nome, unidade: it.unidadeControle, qtdTexto: it.unidadeControle === 'UN' ? '1' : '0,05', custoMedio: it.custoMedio }] : cs))

  const gravar = async (confirmouDose = false) => {
    if (!comps) return
    setDoseAConfirmar(false)
    setErro(null)
    setAviso(null)
    const r0 = recusa(comps)
    if (r0) return setErro(r0)
    setGravando(true)
    try {
      const r = alvo.fichaId
        ? await fetch(`/api/empresas/${companyId}/estoque/fichas/${alvo.fichaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corpoDaEdicao(comps), ...(confirmouDose ? { confirmouDose: true } : {}) }) })
        : await fetch(`/api/empresas/${companyId}/estoque/fichas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoDaCriacao(alvo, comps)) })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        // ⛔ a homônima (409) tem três saídas — elas moram no editor, não aqui (uma porta só)
        setErro(j?.erro ?? 'Não consegui gravar.')
        if (j?.code === 'RECEITA_HOMONIMA' && j?.ficha?.id) setAviso(`/empresas/${companyId}/estoque/fichas/${j.ficha.id}`)
        if (j?.code === 'DOSE_IMPLAUSIVEL') setDoseAConfirmar(true)
        return
      }
      // ⭐ ITEM 5 do editor: gravação incompleta nunca volta calada
      if (!alvo.fichaId && j && j.vinculadoAoPdv === false) setErro('A ficha foi salva, mas não ficou ligada ao nome do PDV.')
      setInicial(JSON.stringify(comps))
      aoGravar()
    } finally {
      setGravando(false)
    }
  }

  if (comps == null) return <div className="ficha" onClick={(e) => e.stopPropagation()}>{erro ?? '…'}</div>

  return (
    <div className="ficha" onClick={(e) => e.stopPropagation()} data-testid="ficha-na-linha">
      {comps.map((c, i) => {
        const q = valorQtd(c.qtdTexto)
        return (
          <div className="ing" key={c.itemId}>
            {/* ⭐ E3 · ingrediente SEM PREÇO: ⚠ na linha e o "sem custo" leva à PORTA que já define o preço
                do insumo hoje (a página do item → entrada/nota) — nenhuma segunda porta de preço */}
            <span className={c.custoMedio == null ? 'sp' : undefined}>{c.custoMedio == null && '⚠ '}{c.nome}{c.custoMedio != null
              ? <span className="q">{`${formatBRL(c.custoMedio)}/${c.unidade}`}</span>
              : <a className="q sp-link" href={`/empresas/${companyId}/estoque/itens/${c.itemId}`} data-testid="sem-custo">sem custo →</a>}</span>
            <span className="dose">
              <button type="button" aria-label="menos" onClick={() => setComps((cs) => cs!.map((x, k) => (k === i ? moverDose(x, -1) : x)))}>−</button>
              <b>{formatarQtd(q, c.unidade)}</b>
              <button type="button" aria-label="mais" onClick={() => setComps((cs) => cs!.map((x, k) => (k === i ? moverDose(x, 1) : x)))}>+</button>
              <span className="v">{q != null && c.custoMedio != null ? formatBRL(q * c.custoMedio) : '·'}</span>
              <button type="button" className="x" aria-label="tirar" onClick={() => setComps((cs) => cs!.filter((_, k) => k !== i))}>✕</button>
            </span>
          </div>
        )
      })}
      <div className="rodape"><span>custo da ficha</span><span data-testid="rodape-ficha">{rodape}</span></div>
      <div className="add">
        {busca
          ? <BuscaItem companyId={companyId} universo="RECEITA" compacto emSerie jaAdicionados={comps.map((c) => c.itemId)} onEscolher={add} placeholder="buscar insumo…" />
          : <button type="button" className="btn-mini" onClick={() => setBusca(true)}>+ adicionar ingrediente</button>}
      </div>
      {(mudou || erro) && (
        <div className="grava">
          {erro && <span className="erro">{erro}{aviso && <> · <a href={aviso}>abrir no editor →</a></>}</span>}
          {doseAConfirmar && <button type="button" className="btn-mini" disabled={gravando} onClick={() => void gravar(true)} data-testid="confirmar-dose">a dose está certa — gravar</button>}
          {mudou && <button type="button" className="btn-mini on" disabled={gravando || !comps.length} onClick={() => void gravar()}>{gravando ? 'gravando…' : 'gravar ficha'}</button>}
        </div>
      )}
    </div>
  )
}
