// ⭐⭐ R42 — O RECIBO ASSINA A SESSÃO (lei v3, docs/contagem-referencia.html): itens, bateram,
// ajustados (líquido E mexido em R$), a apurar, tempo real × estimado, zona por zona com quem
// assinou e a hora, e a acuracidade da sessão × a acumulada. Zona contada SEM assinatura aparece
// dizendo isso — o recibo nunca finge uma assinatura que não houve.
import type { Recibo } from '@/lib/stock/contagem/direcao-dados'
import { Anel } from './graficos'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const sinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '')
const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const diaLongo = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function ReciboDaSessao({ r, empresaId }: { r: Recibo; empresaId: string }) {
  const delta = r.acuracidadeAcumulada != null && r.acuracidadeAntes != null ? r.acuracidadeAcumulada - r.acuracidadeAntes : null
  const fechada = r.status === 'FINALIZADA'
  return (
    <div className="mx-auto max-w-[560px] rounded-[18px] border px-[18px] pb-4 pt-[18px]" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)' }} data-testid="recibo">
      <div className="flex items-center gap-3">
        <Anel pct={r.itens > 0 ? 100 : 0} rotulo={`${r.itens}/${r.itens}`} tamanho={62} />
        <div>
          <div className="text-base font-extrabold" style={{ color: 'var(--prod-primary)' }}>Contagem {fechada ? '— fechada' : r.status === 'CANCELADA' ? '— cancelada' : '— ainda aberta'}</div>
          <div className="mt-0.5 text-[11.5px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>
            {diaLongo(r.iniciadaEm)} · {hm(r.iniciadaEm)}{r.finalizadaEm ? ` → ${hm(r.finalizadaEm)}` : ''}
            {r.minutosReais != null && ` · ${r.minutosReais} min`} (estimado ~{r.minutosEstimados})
          </div>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { rot: 'Bateram', v: String(r.bateram), s: `de ${r.itens}`, cor: 'var(--fam-verde-ink)' },
          { rot: 'Ajustados', v: String(r.ajustados), s: `${sinal(r.liquido)}${brl(Math.abs(r.liquido))} líq. · ${brl(r.mexido)} mexidos`, cor: 'var(--fam-ambar-ink)' },
          { rot: 'A apurar', v: String(r.aApurar), s: '"não sei" registrado', cor: 'var(--prod-primary)' },
          { rot: 'Acuracidade', v: r.acuracidadeSessao == null ? '—' : `${r.acuracidadeSessao}%`, s: r.acuracidadeAcumulada == null ? 'acumulada —' : `acumulada ${r.acuracidadeAcumulada}%${delta != null ? ` (${delta >= 0 ? '+' : '−'}${Math.abs(delta)})` : ''}`, cor: 'var(--prod-primary)' },
        ].map((g) => (
          <div key={g.rot} className="rounded-[11px] border px-2.5 py-2" style={{ borderColor: 'var(--prod-line)' }}>
            <div className="text-[8.5px] font-extrabold uppercase tracking-[0.07em]" style={{ color: 'var(--prod-muted)' }}>{g.rot}</div>
            <div className="mt-0.5 text-[15px] font-extrabold tabular-nums" style={{ color: g.cor }} data-testid={`recibo-${g.rot}`}>{g.v}</div>
            <div className="mt-px text-[9.5px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>{g.s}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--prod-line)' }} data-testid="recibo-zonas">
        {r.zonas.length === 0 && <p className="py-1.5 text-xs" style={{ color: 'var(--prod-muted)' }}>nenhuma zona nesta sessão</p>}
        {r.zonas.map((z) => (
          <div key={z.chave} className="flex items-center gap-2 py-1.5 text-[12.5px] font-bold">
            <span style={{ color: z.quem ? 'var(--fam-verde-ink)' : 'var(--fam-ambar-ink)' }}>{z.quem ? '✓' : '!'}</span>
            <span style={{ color: 'var(--prod-primary)' }}>{z.nome}</span>
            <span className="ml-auto" style={{ color: z.quem ? 'var(--prod-secondary)' : 'var(--fam-ambar-ink)' }}>{z.quem ? `${z.quem}${z.viaPin ? ' (PIN)' : ''}` : 'sem assinatura'}</span>
            <span className="tabular-nums" style={{ color: 'var(--prod-muted)' }}>{z.quando ? hm(z.quando) : ''}</span>
          </div>
        ))}
      </div>

      {r.ajustes.length > 0 && (
        <div className="mt-2.5 border-t pt-2" style={{ borderColor: 'var(--prod-line)' }}>
          {r.ajustes.slice(0, 12).map((a) => (
            <div key={a.itemId} className="flex items-baseline gap-2 py-1 text-[12.5px] font-bold">
              <b style={{ color: 'var(--prod-primary)' }}>{a.nome}</b>
              <span className="tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{sinal(a.divergencia)}{num(Math.abs(a.divergencia))} {a.unidade}</span>
              <span className="ml-auto tabular-nums" style={{ color: a.valor < 0 ? 'var(--fam-ambar-ink)' : 'var(--fam-verde-ink)' }}>{sinal(a.valor)}{brl(Math.abs(a.valor))}</span>
              <a href={`/empresas/${empresaId}/estoque/itens/${a.itemId}`} className="whitespace-nowrap" style={{ color: 'var(--fam-indigo-ink)' }}>investigar →</a>
            </div>
          ))}
          {r.ajustes.length > 12 && <p className="pt-1 text-[11px]" style={{ color: 'var(--prod-muted)' }}>+ {r.ajustes.length - 12} ajustes no Revisar</p>}
        </div>
      )}

      <div className="mt-3 rounded-[11px] px-3 py-2.5 text-xs font-extrabold" data-testid="recibo-assinatura"
        style={r.finalizadaPor ? { background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' } : { background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
        {r.finalizadaPor
          ? `✓ fechada e assinada por ${r.finalizadaPor} · ajustes aplicados linha a linha`
          : fechada ? 'fechada antes do recibo existir — sem assinatura registrada' : 'ainda não foi fechada'}
      </div>
    </div>
  )
}
