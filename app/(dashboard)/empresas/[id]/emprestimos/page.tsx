// ⭐⭐⭐ EMPRÉSTIMOS v1 — A CARTEIRA (docs/emprestimos-referencia.html, R56–R64 · 25/11/2026).
//
// O topo responde em 4 (dívida total bancos × mútuo · custo do dinheiro contratos + cheque · o
// compromisso do mês · livre da dívida em), a MONTANHA mostra o saldo total descendo até zero
// empilhado por credor, o COMPROMISSO mês a mês destaca o pico (MESMA fonte da Mesa/Custos Fixos),
// o pódio diz quem cobra mais caro, e os contratos vêm em grupos por credor — o mútuo à parte (R61).
// ⚠️ Tudo vem de UMA leitura em lote (`/emprestimos/carteira` → `lerCarteiraDeEmprestimos`).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { CarteiraDeEmprestimos } from '@/lib/loans/carteira'
import { ORDEM_DO_CREDOR } from '@/lib/loans/carteira'
import {
  HeroCarteira, Montanha, Compromisso, Podio, CustoPorCredor, ChequeEspecial, GrupoDoCredor, Card, Info, SH,
} from '@/components/emprestimos/visual'
import { fmtR, PALETA } from '@/lib/loans/carteira'

export default function EmprestimosPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const [c, setC] = useState<CarteiraDeEmprestimos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    setLoading(true)
    fetch(`/api/empresas/${empresaId}/emprestimos/carteira`, { credentials: 'include' })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? 'não consegui ler os empréstimos'); return r.json() })
      .then((d: CarteiraDeEmprestimos) => { setC(d); setErro(null) })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setLoading(false))
  }, [empresaId])
  useEffect(() => { carregar() }, [carregar])

  const base = `/empresas/${empresaId}/emprestimos`
  const btn = 'inline-flex h-10 items-center rounded-[12px] px-4 text-[14px] font-semibold no-underline'

  return (
    // ⛔ S24 — a LARGURA DA ÁREA ÚTIL do app: nenhum max-w próprio; o respiro lateral é o do shell
    <div data-tela="emprestimos" className="min-h-full pb-10" style={{ color: 'var(--emp-ink)' }}>
      <header className="mb-[18px] mt-2 flex flex-wrap items-center gap-3.5">
        <h2 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Empréstimos</h2>
        <Info titulo="Empréstimos">
          <p>Contratos de banco e mútuo, o custo do dinheiro (juros apurados + cheque especial), e o que vence mês a mês até ficar livre.</p>
          <p>“~” marca todo valor que contém estimativa (pós-fixado antes do vencimento).</p>
        </Info>
        <div className="ml-auto flex flex-wrap gap-2.5">
          <Link href={`${base}/parcelas-do-mes`} className={btn} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink)' }}>Parcelas do mês</Link>
          <Link href={`${base}/importar-agenda`} className={btn} style={{ background: 'var(--emp-card)', boxShadow: SH, color: 'var(--emp-ink)' }}>Importar agenda do banco</Link>
          <Link href={`${base}/novo`} className={`${btn} text-white`} style={{ background: PALETA.primario }}>Novo empréstimo</Link>
        </div>
      </header>

      {loading && !c && <div className="flex items-center gap-2 py-16 text-[14px]" style={{ color: 'var(--emp-ink2)' }}><Loader2 className="h-4 w-4 animate-spin" />lendo os contratos…</div>}
      {erro && <div className="rounded-[14px] px-4 py-3 text-[14px]" style={{ background: 'var(--emp-rosbg)', color: 'var(--emp-ros)' }}>{erro}</div>}

      {c && c.contratos.length === 0 && (
        <Card titulo="Nenhum empréstimo cadastrado">
          <Link href={`${base}/novo`} className="text-[14px] font-semibold" style={{ color: 'var(--emp-ind)' }}>cadastrar o primeiro →</Link>
        </Card>
      )}

      {c && c.contratos.length > 0 && <>
        <HeroCarteira c={c} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_5fr]">
          <Card id="montanha" titulo="A dívida descendo até zero" sub={`saldo devedor total · ${fmtR(c.totais.total)}`}
            info={<Info titulo="A montanha">
              <p>O saldo total no fim de cada mês, pela agenda do banco, empilhado por credor. Passe o mouse (ou toque) pra ver o mês.</p>
              <p>O mútuo não tem prazo: desce pelas referências da agenda nominal e zera na última delas.</p>
              <p>Cheque especial não tem agenda e fica fora da montanha.</p>
            </Info>}>
            {/* ⭐ celular: a montanha mini, com toque (a lei desenha as duas) */}
            <div className="md:hidden"><Montanha c={c} mini /></div>
            <div className="hidden md:block"><Montanha c={c} /></div>
          </Card>
          <Card id="custo" titulo="Quem cobra mais caro" sub="custo real % a.m. · últimos 12 meses"
            info={<Info titulo="Custo real">
              <p>Encargo apurado (juros + correção + multa) ÷ saldo de abertura das parcelas pagas nos últimos 12 meses.</p>
              <p>O mútuo fica fora do ranking: não cobra juros.</p>
            </Info>}>
            <Podio contratos={c.contratos} />
          </Card>
        </div>

        <Card id="compromisso" titulo="O compromisso mês a mês" sub={`parcelas em aberto até a última · ${c.compromisso.length} meses`}
          info={<Info titulo="Compromisso mês a mês">
            <p>Toda parcela em aberto, no mês em que vence — o mesmo valor que a Mesa e os Custos Fixos usam (um número só no sistema).</p>
            <p>O pico é o mês mais pesado (e os colados nele).</p>
            {c.atrasado.n > 0 && <p>Fora da série: {c.atrasado.n} parcela(s) vencida(s) e não paga(s), {fmtR(c.atrasado.v)}.</p>}
          </Info>}>
          <Compromisso serie={c.compromisso} />
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card titulo={`Custo por credor · ${c.ano}`} sub={`${fmtR(c.custo.contratos)} apurado`}>
            <CustoPorCredor c={c} />
          </Card>
          <Card id="cheque" titulo="Cheque especial" sub={`${fmtR(c.custo.cheque)} no ano · ${fmtR(c.chequeMes)} no mês`}
            info={<Info titulo="Cheque especial / conta garantida">
              <p>Juros de limite das contas: as linhas com o código de juros de limite do banco, as confirmadas pelo dono e as categorizadas como juros de crédito sem contrato.</p>
              <p>Usado = o saldo negativo da conta agora. O limite só aparece quando está cadastrado na conta.</p>
              <p>A caixa de entrada reconhece essas linhas sozinha e pede a confirmação; confirmada uma vez, vira regra.</p>
            </Info>}>
            <ChequeEspecial c={c} />
          </Card>
        </div>

        <div id="grupos">
          {ORDEM_DO_CREDOR.filter((b) => b !== 'mutuo').map((b) => (
            <GrupoDoCredor key={b} banco={b} contratos={c.contratos.filter((k) => k.banco === b)} />
          ))}
          {/* ⛔ R61 — o mútuo é OUTRA natureza: grupo próprio, nunca somado com banco sem rótulo */}
          <GrupoDoCredor banco="mutuo" contratos={c.contratos.filter((k) => k.banco === 'mutuo')} />
        </div>
      </>}
    </div>
  )
}
