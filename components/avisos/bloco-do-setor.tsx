'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { FAMILIA_DA_SEVERIDADE, ROTULO_DO_SETOR, type Setor } from '@/lib/avisos/tipos'
import type { AvisoNaTela } from '@/lib/avisos/central'

/**
 * ⛔⛔⛔ **CAPACIDADE GUARDADA — NÃO É LIXO, É DÍVIDA REGISTRADA.**
 *
 * **Decisão do dono (04/10, ~2h depois de este bloco subir):** *"o bloco inline MORRE — avisos
 * só no sininho do topo (contador + painel). Home limpa: título → cartões → listas. Componente
 * guardado; **nada de aviso inline em tela nenhuma sem o dono pedir**."*
 *
 * ⭐ **A FUNÇÃO NÃO SE PERDEU:** o sininho global mostra os MESMOS avisos (mesma rota, mesma
 * leitura, agrupados por setor, com contador e "marcar lido"). O que saiu foi a **segunda
 * vitrine do mesmo dado** no meio da tela de trabalho — e duas vitrines do mesmo fato é a
 * doença que este projeto mais paga.
 *
 * ⚠️ **Por que o arquivo FICA:** o pedido original era *"estoque e financeiro ganham o bloco
 * depois, mesmo componente"*. Se ele for apagado, no dia em que o dono pedir alguém escreve um
 * segundo — e o segundo divergiria na primeira frase ajustada. O guard
 * `__tests__/regras-ui/avisos-so-no-sininho.test.ts` exige que este selo continue aqui (senão a
 * próxima faxina trata como código morto) **e** proíbe qualquer tela de montá-lo sem o dono
 * pedir. É o mesmo tratamento das 4 capacidades guardadas da faxina do Pendentes (15/09).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BLOCO FINO DE AVISOS POR SETOR (04/10/2026).
 *
 * **Pedido do dono:** *"E POR SETOR dentro das telas: bloco fino entre os cartões e as listas
 * (1 linha por aviso + link; máx 2-3 + 'ver todos'; some quando zero). Na home de PRODUÇÃO só
 * avisos de produção; **financeiro NUNCA aparece na produção (lei)**. Estoque e financeiro
 * ganham o bloco depois, **mesmo componente**."*
 *
 * ⛔⛔ **A LEI NÃO MORA AQUI — mora no WHERE da rota** (`avisosDoSetor`, filtro por `setor`).
 * Se a tela decidisse o que mostrar, a próxima tela nova decidiria de novo e **uma delas
 * decidiria errado**. Este componente recebe o setor e não tem como pedir outro: `?setor=` é
 * recorte sobre o que a permissão já liberou, e pedir financeiro sem `transaction.view` leva
 * **403**, não a lista.
 *
 * ⭐ **UM COMPONENTE, TRÊS TELAS** (produção agora; estoque e financeiro depois). Dois blocos
 * "quase iguais" é literalmente como o verde do cartão ≍ e o do card de 10/09 saíram
 * diferentes — e aqui divergiriam numa frase que cobra ação.
 *
 * ⛔ **SOME QUANDO ZERA** (ordem do dono): móvel fixo zerado treina o dono a não olhar — a
 * mesma razão por que o card de dupla contagem saiu da Conciliação em 10/09. ⚠️ Mas FALHA **não
 * é zero**: carregamento quebrado mostra o motivo e o "tentar de novo", porque *ausência não é
 * prova* (a lição do "erro disfarçado de vazio").
 */

const MOSTRA_POR_PADRAO = 3

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

export function BlocoDeAvisos({ empresaId, setor }: { empresaId: string; setor: Setor }) {
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [avisos, setAvisos] = useState<AvisoNaTela[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [tudo, setTudo] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<{ avisos: AvisoNaTela[] }>(
      `/api/empresas/${empresaId}/avisos?setor=${setor}`,
    )
    if (!r.ok || !r.data) {
      setErro(r.erro ?? 'não consegui carregar os avisos')
      setEstado('FALHOU')
      return
    }
    setAvisos(r.data.avisos)
    setEstado('OK')
  }, [empresaId, setor])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /**
   * ⛔ CARREGANDO não desenha nada: um bloco fantasma empurrando a lista pra baixo a cada
   * abertura de tela é pior que o bloco aparecer 200 ms depois.
   */
  if (estado === 'CARREGANDO') return null

  if (estado === 'FALHOU') {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]"
        style={{ borderColor: 'var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}
      >
        <span>não consegui ler os avisos de {ROTULO_DO_SETOR[setor].toLowerCase()} — {erro}</span>
        <button onClick={() => void carregar()} className="underline">tentar de novo</button>
      </div>
    )
  }

  if (avisos.length === 0) return null // ⭐ some quando zera

  const visiveis = tudo ? avisos : avisos.slice(0, MOSTRA_POR_PADRAO)
  const escondidos = avisos.length - visiveis.length

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}
    >
      {visiveis.map((a) => (
        <LinhaFina key={a.id} a={a} />
      ))}
      {/* ⭐ "ver todos" ABRE AQUI, não navega: o bloco é a casa do aviso daquela tela — mandar o
          dono pra outra página o tiraria de onde o trabalho está (a lição do "definir ficha me
          expulsa da tela", 14/09). */}
      {(escondidos > 0 || tudo) && (
        <button
          onClick={() => setTudo((v) => !v)}
          className="num w-full border-t px-3 py-1.5 text-left text-[11px]"
          style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-secondary)' }}
        >
          {tudo ? 'ver menos' : `ver todos (${avisos.length})`}
        </button>
      )}
    </div>
  )
}

/** ⭐ 1 LINHA por aviso: filete da severidade + a ação + o link. Nada de parágrafo. */
function LinhaFina({ a }: { a: AvisoNaTela }) {
  const fam = FAMILIA_DA_SEVERIDADE[a.severidade]
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-2 last:border-b-0"
      style={{ borderColor: 'var(--prod-line)', borderLeft: `3px solid var(--fam-${fam}-mid)` }}
    >
      <p className="min-w-0 flex-1 text-[13px] leading-snug" style={{ color: 'var(--prod-primary)' }}>
        <span className="font-medium">{a.titulo}</span>
        {/* ⚠️ o "o que fazer" vem na MESMA linha, em tom secundário: bloco fino não pode ter
            parágrafo, mas aviso sem a ação é o ruído que a lei da língua do balcão proíbe. */}
        <span style={{ color: 'var(--prod-secondary)' }}> — {a.oQueFazer}</span>
      </p>
      {a.acaoHref && a.acaoRotulo && (
        <Link
          href={a.acaoHref}
          className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium"
          style={{ borderColor: `var(--fam-${fam}-mid)`, color: `var(--fam-${fam}-ink)`, background: `var(--fam-${fam}-bg)` }}
        >
          {a.acaoRotulo} →
        </Link>
      )}
    </div>
  )
}
