'use client'
// ⭐⭐⭐ O POSTO DE COMANDO — a abertura da contagem (lei v3, R36/R37/R40; docs/contagem-referencia.html).
//
// R40 ACURACIDADE É O PLACAR: o anel (% de itens dentro da tolerância na última contagem — o mesmo
// critério do "Bateram" do Revisar) com a tendência de 30 dias, o R$ SOB CONTAGEM (giro 30d do
// grupo A), os AJUSTES POR SEMANA em escala única e os NUNCA CONTADOS com os candidatos.
// R36/R37 O QUE CONTA HOJE + O MAPA DAS ZONAS: cartão por zona com anel feitos/hoje, última
// contagem (quem · quando), AO VIVO quem está contando, "contar esta zona →", "nada pra hoje".
// "Contar tudo (N) →" continua existindo como escolha explícita.
import { useState } from 'react'
import type { Posto } from '@/lib/stock/contagem/direcao-dados'
import { formatBRLCompact } from '@/lib/format/money'
import { Anel, BarrasDaSemana } from './graficos'

// ⭐ moeda sai do formatador da casa (a cicatriz do "R$ R$"); só o sufixo vira "mil", como na lei
const brlCurto = (n: number) => formatBRLCompact(n).replace(/K$/, ' mil')
const quandoCurto = (iso: string, agora = new Date()) => {
  const d = new Date(iso)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const dia = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const ontem = new Date(agora.getTime() - 86_400_000)
  if (dia(d) === dia(agora)) return `hoje · ${hm}`
  if (dia(d) === dia(ontem)) return `ontem · ${hm}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Info({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-label="o que é isto"
        className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-full border text-[10.5px] font-extrabold normal-case"
        style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-muted)', background: 'var(--prod-surface)' }}>i</button>
      {aberto && (
        <span className="absolute left-[-8px] top-[22px] z-20 w-[280px] rounded-[10px] px-3 py-2.5 text-[11.5px] font-semibold normal-case leading-relaxed tracking-normal"
          style={{ background: 'var(--prod-primary)', color: 'var(--prod-surface)' }}>{children}</span>
      )}
    </span>
  )
}

const rot = 'text-[9.5px] font-extrabold uppercase tracking-[0.08em]'
const cartao = 'rounded-[14px] border px-4 py-3.5'
const corCartao = { borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)' }

export function PostoDeComando({ id, posto, sessaoAberta, iniciando, podeGerenciar, onComecar }: {
  id: string
  posto: Posto
  sessaoAberta: boolean
  iniciando: boolean
  podeGerenciar: boolean
  onComecar: (escopo: string) => void
}) {
  const a = posto.acuracidade
  const t = a.tendencia30
  const sem = posto.ajustesSemanas
  const estaSemana = sem[sem.length - 1]
  const hoje = posto.hoje
  const zonasComDia = posto.zonas.filter((z) => z.hoje > 0).length
  const tudoFeito = hoje.itens.length > 0 && hoje.feitos >= hoje.itens.length

  return (
    <div data-testid="posto-de-comando">
      <header className="flex flex-wrap items-end justify-between gap-3.5">
        <h1 className="m-0 text-[21px] font-extrabold tracking-tight" style={{ color: 'var(--prod-primary)' }}>Contagem</h1>
        <div className="flex flex-wrap gap-4 text-xs font-extrabold">
          <button type="button" onClick={() => onComecar('tudo')} className="no-underline" style={{ color: 'var(--fam-indigo-ink)' }} data-testid="contar-tudo">
            contar tudo ({posto.totalItens}) →
          </button>
          {podeGerenciar && <a href={`/empresas/${id}/estoque/contagem/zonas`} style={{ color: 'var(--fam-indigo-ink)' }}>zonas e grupos →</a>}
          <a href={`/empresas/${id}/estoque/contagens`} style={{ color: 'var(--fam-indigo-ink)' }}>Sessões →</a>
        </div>
      </header>

      {/* ── o placar (R40) ── */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1.15fr_1fr]">
        <div className={cartao} style={corCartao} data-testid="placar-acuracidade">
          <div className={rot} style={{ color: 'var(--prod-muted)' }}>Acuracidade do estoque</div>
          <div className="mt-2 flex items-center gap-3.5">
            <Anel pct={a.pct} rotulo={a.pct == null ? '—' : `${a.pct}%`} tamanho={86} verdeAoCompletar={false} />
            <div>
              <div className="text-[13px] font-extrabold tabular-nums" style={{ color: t == null ? 'var(--prod-muted)' : t >= 0 ? 'var(--fam-verde-ink)' : 'var(--fam-coral-ink)' }}>
                {t == null ? 'sem base de 30 dias' : `${t >= 0 ? '+' : '−'}${Math.abs(t)} pontos · 30 dias`}
              </div>
              <div className="mt-0.5 text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>
                {a.total > 0 ? <><b style={{ color: 'var(--prod-secondary)' }}>{a.dentro} de {a.total}</b> itens bateram na última contagem</> : 'nenhuma contagem ainda — o placar nasce na primeira'}
              </div>
            </div>
          </div>
        </div>
        <div className={cartao} style={corCartao} data-testid="placar-sob-contagem">
          <div className={rot} style={{ color: 'var(--prod-muted)' }}>Sob contagem · grupo A</div>
          <div className="mt-1.5 text-[20px] font-extrabold tabular-nums" style={{ color: 'var(--prod-primary)' }}>{brlCurto(posto.sobContagem.valor)}</div>
          <div className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>
            {posto.sobContagem.pctDoGiro != null && <b style={{ color: 'var(--prod-secondary)' }}>{posto.sobContagem.pctDoGiro}% do giro</b>} protegido · {posto.sobContagem.itens} itens · giro 30 dias
          </div>
        </div>
        <div className={cartao} style={corCartao} data-testid="placar-ajustes">
          <div className={rot} style={{ color: 'var(--prod-muted)' }}>Ajustes · por semana</div>
          <div className="mt-1.5 text-[20px] font-extrabold tabular-nums" style={{ color: estaSemana.liquido < 0 ? 'var(--fam-ambar-ink)' : 'var(--prod-primary)' }}>
            {estaSemana.liquido === 0 ? 'R$ 0' : brlCurto(estaSemana.liquido)}
          </div>
          <BarrasDaSemana valores={sem.map((s) => s.mexido)} rotulos={sem.map((_, k) => (k === sem.length - 1 ? 'esta' : `s${k + 1}`))} />
        </div>
        <div className={cartao} style={corCartao} data-testid="placar-nunca-contados">
          <div className={rot} style={{ color: 'var(--prod-muted)' }}>Nunca contados</div>
          <div className="mt-1.5 text-[20px] font-extrabold tabular-nums" style={{ color: posto.nuncaContados.total > 0 ? 'var(--fam-ambar-ink)' : 'var(--prod-primary)' }}>{posto.nuncaContados.total}</div>
          <div className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>
            <b style={{ color: 'var(--prod-secondary)' }}>{posto.nuncaContados.candidatos.length} candidatos</b> a grupo A
            {posto.nuncaContados.candidatos.length > 0 && podeGerenciar && (
              <> · <a href={`/empresas/${id}/estoque/contagem/candidatos`} className="font-extrabold" style={{ color: 'var(--fam-indigo-ink)' }}>decidir →</a></>
            )}
          </div>
        </div>
      </div>

      {/* ── o que conta hoje + o mapa das zonas (R36/R37) ── */}
      <div className={`${cartao} mt-4`} style={corCartao} data-testid="conta-hoje">
        <div className={`mb-1 flex items-center gap-2 ${rot}`} style={{ color: 'var(--prod-muted)' }}>
          O que conta hoje
          <Info>
            A lista do dia nasce da regra dos grupos (A a cada {posto.ritmo.A} dia{posto.ritmo.A > 1 ? 's' : ''} ·
            B a cada {posto.ritmo.B} · C a cada {posto.ritmo.C}, editável): atrasado entra primeiro, item sem
            zona entra no fim. Cada zona segue a ordem em que vocês andam pelo estoque. Zona fechada assina
            com quem contou; várias pessoas contam zonas diferentes da mesma sessão. As zonas são tuas.
          </Info>
        </div>
        <div className="mb-3 mt-0.5 flex flex-wrap items-center gap-3.5">
          <span className="text-[17px] font-extrabold tabular-nums" style={{ color: 'var(--prod-primary)' }} data-testid="hoje-resumo">
            {hoje.itens.length === 0
              ? 'nada vence hoje'
              : tudoFeito
                ? `${hoje.feitos} de ${hoje.itens.length} ✓`
                : `${hoje.itens.length} itens · ${zonasComDia} ${zonasComDia === 1 ? 'zona' : 'zonas'} · ~${hoje.estimadoMin} min`}
          </span>
          {hoje.itens.length > 0 && !tudoFeito && (
            <span className="text-xs font-bold" style={{ color: 'var(--prod-secondary)' }}>
              {sessaoAberta && hoje.feitos > 0 ? `${hoje.feitos} feitos · ` : ''}atrasados primeiro · contagem cega
            </span>
          )}
          <span className="flex-1" />
          {hoje.itens.length > 0 && !tudoFeito && (
            <button type="button" onClick={() => onComecar('hoje')} disabled={iniciando} data-testid="comecar-hoje"
              className="h-[42px] rounded-[10px] px-[18px] text-[13.5px] font-extrabold disabled:opacity-50"
              style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>
              {sessaoAberta ? 'Continuar a contagem de hoje' : 'Começar a contagem de hoje'}
            </button>
          )}
        </div>

        {posto.zonas.length === 0 ? (
          <p className="rounded-[13px] border border-dashed px-3 py-3 text-xs font-bold" style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-muted)' }}>
            Ainda não há zonas. {podeGerenciar ? <a href={`/empresas/${id}/estoque/contagem/zonas`} style={{ color: 'var(--fam-indigo-ink)' }}>criar as zonas do estoque →</a> : 'O dono cria as zonas.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="mapa-das-zonas">
            {posto.zonas.map((z) => {
              const emDia = z.hoje === 0 || z.feitos >= z.hoje
              return (
                <div key={z.chave} data-zona={z.chave} className={`relative rounded-[13px] border px-3 py-3 ${emDia && !z.aoVivo ? 'opacity-75' : ''}`}
                  style={{ borderColor: 'var(--prod-line-strong)', borderStyle: z.chave === '__sem_zona__' ? 'dashed' : 'solid' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-extrabold" style={{ color: z.chave === '__sem_zona__' ? 'var(--fam-ambar-ink)' : 'var(--prod-primary)' }}>{z.nome}</span>
                    {z.aoVivo && (
                      <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-extrabold" style={{ color: 'var(--fam-verde-ink)' }} data-testid="ao-vivo">
                        <span className="h-[7px] w-[7px] animate-pulse rounded-full" style={{ background: 'var(--fam-verde-mid)' }} />{z.aoVivo} contando
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Anel pct={z.hoje > 0 ? (z.feitos / z.hoje) * 100 : 100} rotulo={`${z.feitos}/${z.hoje}`} />
                    <div>
                      <div className="text-xs font-extrabold tabular-nums" style={{ color: emDia ? 'var(--fam-verde-ink)' : 'var(--prod-primary)' }}>
                        {emDia
                          ? 'em dia ✓'
                          : <>{z.atrasados > 0 && <span style={{ color: 'var(--fam-ambar-ink)' }}>{z.atrasados} atrasado{z.atrasados > 1 ? 's' : ''} · </span>}{z.feitos > 0 ? `${z.feitos} de ${z.hoje} feitos` : `${z.hoje} hoje`} · {z.totalNaZona} na zona</>}
                      </div>
                      <div className="mt-0.5 text-[10.5px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                        {z.assinada
                          ? `fechada: ${z.assinada.quem} · ${quandoCurto(z.assinada.quando)}`
                          : z.ultima ? `${quandoCurto(z.ultima.quando)}${z.ultima.quem ? ` · ${z.ultima.quem}` : ''}` : 'nunca contada'}
                      </div>
                    </div>
                  </div>
                  <button type="button" disabled={emDia || iniciando} onClick={() => onComecar(`zona:${z.chave}`)}
                    className="mt-2.5 h-8 w-full rounded-[9px] border text-xs font-extrabold disabled:cursor-default"
                    style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: emDia ? 'var(--prod-muted)' : 'var(--fam-indigo-ink)' }}>
                    {emDia ? 'nada pra hoje' : z.aoVivo ? 'contar junto →' : 'contar esta zona →'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

