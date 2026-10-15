'use client'

/**
 * ⭐⭐⭐ A MESA DA COZINHA ② — o novo TOPO da tela "HOJE ao vivo" (15/10/2026).
 *
 * **`docs/dashboard-referencia.html` é a LEI** do visual e do comportamento: 6 blocos, nesta
 * ordem e com estes spans — placar (c12) · radar (c5) · quem fez o dia (c7) · a fita (c12) ·
 * últimas conclusões (c6) · a semana (c6).
 *
 * ⛔⛔ **A TELA ECOA, NÃO CALCULA.** Todo número vem do payload que o servidor assinou
 * (`lerMesaDaCozinha` → portas existentes → libs puras). ⚠️ Uma soma no JSX seria a 2ª conta do
 * mesmo dado, e o guard proíbe.
 *
 * ⛔ **O CHASSI É O COMPARTILHADO** (`components/mesa/chassi`): o mesmo cartão, o mesmo radar e
 * a mesma fita da mesa ①. Um chassi próprio aqui divergiria no primeiro ajuste de tom, e as
 * duas telas que o dono alterna com um toque teriam cara diferente.
 *
 * ⛔ **ZERO HEX DE COR** — tudo por token, com par nos dois temas.
 */

import Link from 'next/link'
import type { MesaDaCozinha } from '@/lib/stock/producao/mesa-da-cozinha'
import { fraseDaFitaDaCozinhaVazia } from '@/lib/stock/producao/fita-da-cozinha'
import { formatBRL } from '@/lib/format/money'
/**
 * ⭐ O PERCENTUAL TEM DONO (`lib/format/percentual.ts`, 10/10) — e o motivo é medido: três
 * cópias de `(pct * 100).toFixed()` puseram **`47.7%` de PONTO** num ⓘ de dinheiro. *O dono
 * escreve com vírgula.*
 *
 * ⚠️ E a exceção fica NOMEADA: a **altura da barra** da semana também é um `* 100` com `%`, e
 * aquele é percentual de **LAYOUT** (CSS), não de DADO — `pctInteiroBR` ali produziria uma
 * altura que o browser não entende.
 */
import { pctInteiroBR } from '@/lib/format/percentual'
import { Mod, RadarDaMesa, FitaDaMesa, MesaGrid, TOM } from '@/components/mesa/chassi'

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const inicial2 = (n: string) =>
  n
    .trim()
    .slice(0, 2)
    .toUpperCase() || '??'

/** ⭐ o tom do rendimento sai da FAIXA que o servidor assinou — a tela não julga */
const TOM_DA_FAIXA: Record<string, string> = {
  NORMAL: 'var(--fam-verde-ink)',
  ACIMA: 'var(--fam-ambar-ink)',
  ABAIXO: 'var(--fam-ambar-ink)',
  SEM_REGUA: 'var(--prod-muted)',
}

/**
 * ⭐ A FORMA QUE CHEGA PELO JSON — `Date` virou `string` na serialização, e a mesa ② só precisa
 * do `ehHoje` do dia (o resto do `DiaAoVivo` é da lista de baixo, que tem o tipo dela).
 *
 * ⚠️ Declarar o que a tela USA (em vez de reescrever o payload inteiro à mão) é o que impede a
 * dívida de 01/09 — *interface escrita à mão sobre payload é promessa, não prova*: aqui o resto
 * dos campos é **derivado** do tipo do servidor, e um rename lá quebra o `tsc` aqui.
 */
export type MesaParaTela = Omit<MesaDaCozinha, 'diaAoVivo'> & {
  diaAoVivo: { ehHoje: boolean }
}

export function MesaDaCozinhaUI({ mesa }: { mesa: MesaParaTela }) {
  const E = `/empresas/${mesa.empresaId}`
  const p = mesa.placar

  return (
    <MesaGrid>
      {/* ───────────── 1. O PLACAR DA COZINHA (c12) ───────────── */}
      <Mod
        span={12}
        titulo="A COZINHA HOJE"
        aoVivo={mesa.diaAoVivo.ehHoje}
        link={{ rotulo: 'todas as ordens', href: `${E}/estoque/producao` }}
      >
        <div className="grid grid-cols-4 tabular-nums max-[700px]:grid-cols-2">
          <Celula
            rotulo="EM ABERTO"
            valor={String(p.emAberto)}
            nota={p.emAberto === 0 ? 'nada andando agora' : 'ordens andando'}
          />
          {/*
            * ⚠️ "NA BANCADA" é o R$ de insumo que SAIU da prateleira e ainda não virou produto
            * (o armazém virtual). ⛔ Não é "produzido": é dinheiro PARADO, e é por isso que ele
            * tem card próprio desde o painel de 2.4.
            */}
          <Celula
            rotulo="NA BANCADA"
            valor={formatBRL(p.valorEmProducao)}
            nota={p.valorEmProducao === 0 ? 'nada parado agora' : 'insumo fora da prateleira'}
          />
          {/* ⭐ o selo verde-escuro da referência — o número que o dono procura primeiro */}
          <div
            className="m-[8px] px-[16px] py-[12px]"
            style={{
              background: 'var(--fam-verde-solid)',
              color: 'var(--fam-verde-on)',
              borderRadius: '12px',
            }}
          >
            <div className="text-[11px] font-extrabold tracking-[0.06em] opacity-80">
              ✓ CONCLUÍDAS HOJE
            </div>
            <div className="mt-[3px] text-[30px] font-extrabold tracking-[-0.02em]">
              {p.concluidasNoPeriodo}
            </div>
            <div className="mt-[2px] text-[11px] font-semibold opacity-80">
              {formatBRL(p.valorProduzidoNoPeriodo)} produzidos
            </div>
          </div>
          <Celula
            rotulo="RENDIMENTO"
            valor={p.rendimentoPeriodo == null ? 'a apurar' : pctInteiroBR(p.rendimentoPeriodo)}
            cor={TOM_DA_FAIXA[p.faixaRendimento] ?? 'var(--prod-muted)'}
            /* ⛔ "a apurar" NUNCA vira 0% — zero é uma afirmação, e lote sem régua não tem % */
            nota={
              p.rendimentoPeriodo == null
                ? 'nenhum lote com régua ainda'
                : `de ${p.lotesNaMedia} lote(s)`
            }
          />
        </div>
        {/* ⭐ a faixa do rodapé vem MONTADA da lib (`faixaDoRodape`) — a frase é testável lá */}
        <div
          className="border-t px-[18px] py-[10px] text-[12.5px] font-bold tabular-nums"
          style={{
            borderColor: 'var(--prod-line)',
            background: 'var(--prod-surface-1)',
            color: 'var(--prod-secondary)',
          }}
        >
          {p.faixa}
        </div>
      </Mod>

      {/* ───────────── 2. RADAR DA COZINHA (c5) ───────────── */}
      <Mod
        span={5}
        titulo="RADAR DA COZINHA"
        link={{ rotulo: 'fila', href: `${E}/estoque/producao/conferencia` }}
      >
        <RadarDaMesa
          linhas={mesa.radar}
          placar={mesa.placarDoRadar}
          fraseVazia="a cozinha está em ordem"
        />
      </Mod>

      {/* ───────────── 3. QUEM FEZ O DIA (c7) ───────────── */}
      <Mod
        span={7}
        titulo="QUEM FEZ O DIA"
        link={{ rotulo: 'por pessoa', href: `${E}/estoque/producao/pessoas` }}
      >
        <div className="px-[6px] pb-[8px] pt-[2px]">
          {mesa.quemFezODia.length === 0 ? (
            <Vazio>ninguém registrou tarefa hoje</Vazio>
          ) : (
            mesa.quemFezODia.map((q) => (
              <div
                key={q.colaboradorId}
                className="flex items-center gap-[10px] px-[10px] py-[8px] text-[13px] font-bold tabular-nums"
              >
                <span
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[11px] font-extrabold"
                  style={{ background: 'var(--fam-indigo-bg)', color: 'var(--prod-accent)' }}
                  aria-hidden
                >
                  {inicial2(q.nome)}
                </span>
                <span className="truncate">{q.nome}</span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: 'var(--prod-muted)' }}
                >
                  {q.tarefas} tarefa(s)
                  {/* ⛔ tarefa sem tempo medido é DITA, nunca escondida (13/09) */}
                  {q.tarefasSemTempo > 0 && ` · ${q.tarefasSemTempo} sem tempo`}
                  {q.tarefasRelampago > 0 && ` · ${q.tarefasRelampago} relâmpago`}
                </span>
                <span className="ml-auto font-extrabold">{q.quantidade.texto}</span>
              </div>
            ))
          )}
        </div>
      </Mod>

      {/* ───────────── 4. A FITA DA COZINHA (c12) ───────────── */}
      <FitaDaMesa
        eventos={mesa.fita}
        fraseVazia={fraseDaFitaDaCozinhaVazia}
        rotulo="a fita da cozinha"
      />

      {/* ───────────── 5. ÚLTIMAS CONCLUSÕES (c6) ───────────── */}
      <Mod
        span={6}
        titulo="ÚLTIMAS CONCLUSÕES"
        link={{
          rotulo: `as ${mesa.conclusoesNoDia} de hoje`,
          href: `${E}/estoque/producao?aba=concluidas`,
        }}
      >
        <div className="px-[6px] pb-[8px] pt-[2px]">
          {mesa.ultimasConclusoes.length === 0 ? (
            <Vazio>nenhum lote fechado ainda hoje</Vazio>
          ) : (
            mesa.ultimasConclusoes.map((c) => (
              <Link
                key={c.conclusaoId}
                href={`${E}/estoque/producao/${c.ordemId}`}
                className="flex items-center gap-[8px] px-[10px] py-[8px] text-[13px] font-bold tabular-nums hover:underline"
              >
                <span className="truncate">{c.produto}</span>
                <Selo estado={c.estado} corrigiuDe={c.corrigiuDe} />
                <span className="ml-auto flex items-baseline gap-[6px] font-extrabold">
                  {c.saiuTxt}
                  {/* ⛔ sem pedido registrado NÃO existe pílula — nunca 100% inventado */}
                  {c.pilula && (
                    <span
                      className="rounded-full px-[8px] py-[2px] text-[10px] font-extrabold"
                      style={{
                        background: TOM[tomDaPilula(c.pilula.tom)].fundo,
                        color: TOM[tomDaPilula(c.pilula.tom)].tinta,
                      }}
                    >
                      {c.pilula.alarme && '⚠ '}
                      {c.pilula.texto}
                    </span>
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      </Mod>

      {/* ───────────── 6. A SEMANA DA COZINHA (c6) ───────────── */}
      <Mod
        span={6}
        titulo={`A SEMANA DA COZINHA · ${mesa.semana.barraEmLotes ? 'LOTES' : 'POR DIA'}`}
        link={{ rotulo: 'por dia', href: `${E}/estoque/producao/relatorios` }}
      >
        <div className="flex h-[120px] items-end gap-[6px] px-[16px] pb-[14px] pt-[8px]">
          {mesa.semana.dias.map((d) => (
            <div
              key={d.dia}
              className="flex h-full flex-1 flex-col items-center justify-end gap-[5px]"
              title={`${d.dia} · ${d.texto} · ${d.lotes} lote(s)`}
            >
              <div
                className="w-full max-w-[34px] rounded-t-[6px]"
                style={{
                  /* ⚠️ altura MÍNIMA de 2px quando houve produção: barra invisível se lê como
                     "não produziu", e dia com lote pequeno produziu sim. */
                  height: `${d.proporcao > 0 ? Math.max(2, Math.round(d.proporcao * 100)) : 0}%`,
                  background: d.ehHoje ? 'var(--fam-verde-mid)' : 'var(--prod-accent)',
                  opacity: 0.9,
                }}
              />
              <span
                className="text-[10.5px] font-extrabold"
                style={{ color: d.ehHoje ? 'var(--fam-verde-ink)' : 'var(--prod-muted)' }}
              >
                {d.rotulo}
              </span>
            </div>
          ))}
        </div>
        {/* ⚠️ a barra MEDINDO LOTES tem que DIZER — somar UN com KG numa barra só seria o
            `1.415,84 un` de 13/09 em forma de gráfico. */}
        {mesa.semana.barraEmLotes && (
          <div
            className="px-[16px] pb-[12px] text-[11px] font-bold"
            style={{ color: 'var(--prod-muted)' }}
          >
            a barra mede LOTES — a semana tem unidades diferentes (UN e KG) e elas não somam
          </div>
        )}
      </Mod>

      {/* ⚠️ o que a mesa NÃO alcançou, nunca silencioso */}
      {mesa.naoAlcancado.length > 0 && (
        <div
          className="col-span-12 border px-[14px] py-[9px] text-[12px] font-bold"
          style={{
            background: 'var(--fam-ambar-bg)',
            borderColor: 'var(--fam-ambar-mid)',
            color: 'var(--fam-ambar-ink)',
            borderRadius: 'var(--prod-r-cartao)',
          }}
        >
          não consegui ler: {mesa.naoAlcancado.join(' · ')} — o resto da mesa está completo
        </div>
      )}
    </MesaGrid>
  )
}

/** ⚠️ o vocabulário da pílula é `verde|ambar|vermelho`; o do chassi é `VERDE|AMBAR|CORAL` */
function tomDaPilula(t: 'verde' | 'ambar' | 'vermelho'): string {
  return t === 'verde' ? 'VERDE' : t === 'ambar' ? 'AMBAR' : 'CORAL'
}

function Celula({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string
  valor: string
  nota: string
  cor?: string
}) {
  return (
    <div
      className="border-l px-[18px] py-[14px] first:border-l-0"
      style={{ borderColor: 'var(--prod-line)' }}
    >
      <div
        className="text-[11px] font-extrabold tracking-[0.06em]"
        style={{ color: 'var(--prod-muted)' }}
      >
        {rotulo}
      </div>
      <div
        className="mt-[3px] text-[30px] font-extrabold tracking-[-0.02em]"
        style={{ color: cor ?? 'var(--prod-primary)' }}
      >
        {valor}
      </div>
      <div className="mt-[2px] text-[11px] font-semibold" style={{ color: 'var(--prod-muted)' }}>
        {nota}
      </div>
    </div>
  )
}

/**
 * ⭐ O SELO DOS DOIS ✓✓ — e o *"corrigida"* carrega o **rastro** (`era 107`).
 *
 * ⛔⛔ Esconder o `corrigiuDe` faria a linha mostrar um número que o declarante nunca digitou
 * sem dizer que houve correção — e o rastro é LEI nesta casa (12/10).
 */
function Selo({
  estado,
  corrigiuDe,
}: {
  estado: MesaDaCozinha['ultimasConclusoes'][number]['estado']
  corrigiuDe: number | null
}) {
  if (estado === 'AGUARDANDO_CONFERENCIA') {
    return (
      <span
        className="flex-none rounded-full px-[8px] py-[2px] text-[10px] font-extrabold"
        style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}
      >
        aguarda conferência
      </span>
    )
  }
  const corrigida = estado === 'CORRIGIDA_E_CONFERIDA'
  return (
    <span
      className="flex-none rounded-full px-[8px] py-[2px] text-[10px] font-extrabold"
      style={{
        background: corrigida ? 'var(--fam-indigo-bg)' : 'var(--fam-verde-bg)',
        color: corrigida ? 'var(--prod-accent)' : 'var(--fam-verde-ink)',
      }}
    >
      ✓✓{corrigida && corrigiuDe != null ? ` corrigida (era ${num(corrigiuDe)})` : ''}
    </span>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[10px] py-[10px] text-[12.5px] font-bold" style={{ color: 'var(--prod-muted)' }}>
      {children}
    </div>
  )
}
