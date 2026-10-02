'use client'

/**
 * ⭐⭐⭐ A CONTA DE PADEIRO — UM COMPONENTE, DUAS TELAS (29/09/2026).
 *
 * **A ordem do dono na mesa de perícia:** *"tocar a linha abre a CONTA DE PADEIRO existente
 * (mesmo componente do Radar)"*.
 *
 * ⛔⛔ Ela vivia DENTRO da tela do Radar. Copiá-la pro Real × Teórico seria a segunda
 * derivação da mesma explicação — e as duas divergiriam no primeiro balde novo, com o dono
 * vendo a mesma janela contada de dois jeitos em duas telas. Extraída, não reescrita: o
 * corpo abaixo é o MESMO, e o Radar passou a importar daqui.
 *
 * ⚠️ Ela recebe a `ContaDePadeiro` PRONTA (do motor) — não remonta nada. *Σ(conta) ==
 * veredito da linha, sempre*, porque os dois saem do mesmo objeto.
 */

import Link from 'next/link'
import { RADAR } from '@/components/estoque/radar-tokens'
import type { ContaDePadeiro as Conta } from '@/lib/stock/radar/fechamento'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
/** ⚠️ o dia do BRASIL — "DEVE TER AGORA" não pode virar ontem às 21h */
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/**
 * ⭐⭐ A CONTA DE PADEIRO — *"tinha ontem → comprou/produziu → vendeu → DEVIA TER →
 * CONTAMOS → FALTOU"*.
 *
 * ⛔ **Σ(conta) == veredito da linha, sempre** — o número de baixo é o MESMO da pílula de
 * cima, porque os dois saem do mesmo `l.conta`. Recalcular aqui seria a segunda régua.
 */
export function ContaDePadeiro({ conta, unidade, itemId, empresaId }: {
  conta: Conta; unidade: string; itemId: string; empresaId: string
}) {
  const c = conta
  const un = unidade
  return (
    <div className="border-t px-4 py-4" style={{ borderColor: RADAR.line, background: RADAR.roxoBg }}>
      {/* ⭐ A JANELA ESCRITA (decisão do dono): duas linhas da mesma tela podem falar de
          janelas diferentes, e esconder isso mentiria o tamanho do furo. */}
      <p className="mb-2.5 text-[11.5px] font-semibold" style={{ color: RADAR.sub }}>
        {c.desde
          ? <>desde a contagem de <b style={{ color: RADAR.ink }}>{br(c.desde)}</b>
            {c.diasDaJanela != null && <> — {c.diasDaJanela === 0 ? 'no mesmo dia' : `${c.diasDaJanela} dia${c.diasDaJanela > 1 ? 's' : ''}`}</>}</>
          : <>primeira contagem deste item — a janela é desde o começo do histórico</>}
      </p>
      <table className="w-full text-[13px]">
        <tbody>
          <tr>
            <td className="py-1.5" style={{ color: RADAR.sub }}>tinha</td>
            <td className="py-1.5 text-right font-bold tabular-nums">{qtd(c.tinha)} {un}</td>
          </tr>
          {c.baldes.map((b) => (
            <tr key={b.chave}>
              <td className="py-1.5" style={{ color: RADAR.sub }}>
                {b.rotulo}
                {/* ⭐⭐ v1.2 — OS DIAS, escritos: "vendeu (baixas de 18 e 19/09)".
                    ⛔ Sem isto o "− 319 UN" é um número que só quem escreveu o código
                    consegue explicar. Acima de 3 dias vira intervalo, senão a linha estoura. */}
                {/* ⚠️ o retroativo já carrega as datas NO rótulo (fato × lançamento) —
                    repetir aqui seria dizer a mesma data duas vezes na mesma linha */}
                {b.chave !== 'foraDeOrdem' && b.dias && b.dias.length > 0 && (
                  <span className="ml-1 opacity-70">
                    ({b.dias.length <= 3
                      ? `${b.chave === 'vendeu' ? 'baixas de ' : ''}${b.dias.map(br).join(' e ')}`
                      : `${b.dias.length} dias, de ${br(b.dias[0]!)} a ${br(b.dias[b.dias.length - 1]!)}`})
                  </span>
                )}
                {/* ⛔ o número é o que o sistema SABE — a ressalva impede que ele se passe
                    por completo (*"nunca fingir que já desceu o que não desceu"*) */}
                {b.ressalva && (
                  <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: RADAR.ambar }}>
                    ⚠️ {b.ressalva}
                  </span>
                )}
              </td>
              {/* ⚠️ a linha que NÃO SOMA parece que não soma: sem sinal, em cinza e entre
                  parênteses. ⛔ Ela aparece porque somir calado seria o buraco do outro lado
                  (o fato já aconteceu, só não estava na foto da contagem). */}
              <td className="py-1.5 text-right font-bold tabular-nums"
                style={b.foraDoTotal ? { color: RADAR.mudo, fontWeight: 500 } : undefined}>
                {b.foraDoTotal
                  ? `(${qtd(Math.abs(b.qtd))} ${un})`
                  : `${b.qtd >= 0 ? '+' : '−'} ${qtd(Math.abs(b.qtd))} ${un}`}
              </td>
            </tr>
          ))}
          <tr className="border-t" style={{ borderColor: RADAR.line }}>
            {/* ⭐⭐⭐ A LEI DE 02/10: **a conta de padeiro SOMA SEMPRE.** O "devia ter" é o
                mesmo número que as linhas acima dão somadas — e é por isso que toda parcela
                que o motor usa tem LINHA (`ajuste`, `lançamento retroativo`, `outros`).
                ⛔ Antes a Coca 2L imprimia "tinha 265 · vendeu −81 · devia ter 147" (265−81
                = 184) e os 37 viviam num rodapé. */}
            <td className="pt-2 font-extrabold">{c.contamos == null ? (c.ate === hoje ? 'DEVE TER AGORA' : `DEVIA TER EM ${br(c.ate)}`) : 'DEVIA TER'}</td>
            <td className="pt-2 text-right font-extrabold tabular-nums">{qtd(c.deviaTer)} {un}</td>
          </tr>
          {/* ⛔ SEM CONTAGEM as duas últimas dizem que FALTA CONTAR — o sistema mostra o
              que sabe e para onde não sabe. Um zero aqui afirmaria que bateu. */}
          <tr>
            <td className="py-1.5 font-extrabold" style={{ color: c.contamos == null ? RADAR.mudo : undefined }}>CONTAMOS</td>
            <td className="py-1.5 text-right font-extrabold tabular-nums"
              style={{ color: c.contamos == null ? RADAR.mudo : undefined }}>
              {c.contamos == null ? '— falta contar' : `${qtd(c.contamos)} ${un}`}
            </td>
          </tr>
          <tr className="border-t-2"
            style={{ borderColor: c.faltouValor == null ? RADAR.line : c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
            <td className="pt-2 text-[14.5px] font-extrabold"
              style={{ color: c.faltouValor == null ? RADAR.mudo : c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
              {c.faltouValor == null ? 'FALTOU / SOBROU' : c.faltouValor < 0 ? 'FALTOU' : c.faltouValor > 0 ? 'SOBROU' : 'BATEU'}
            </td>
            <td className="pt-2 text-right text-[14.5px] font-extrabold tabular-nums"
              style={{ color: c.faltouValor == null ? RADAR.mudo : c.faltouValor < 0 ? RADAR.coral : RADAR.verde }}>
              {c.faltouValor == null || c.faltou == null
                ? '— falta contar'
                : `${qtd(Math.abs(c.faltou))} ${un} · ${brl(Math.abs(c.faltouValor))}`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ⛔ A CONTA QUE NÃO FECHA **DIZ** — nunca se esconde atrás de um número redondo */}
      {c.naoExplicado !== 0 && (
        <p className="mt-2.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold"
          style={{ background: RADAR.ambarBg, color: RADAR.ambar }}>
          ⚠️ {qtd(Math.abs(c.naoExplicado))} {un} desta janela não têm movimento que explique.
          {/* ⭐ e quando o servidor SABE o porquê provável, ele diz — resíduo mudo é o que
              fazia o dono somar no dedo e achar um furo que não é furo */}
          {c.pista ? <span className="mt-0.5 block font-normal">{c.pista}</span> : null}
        </p>
      )}

      <Link href={`/empresas/${empresaId}/estoque/movimentos?itemId=${itemId}`}
        className="mt-3 inline-block text-[12.5px] font-bold" style={{ color: RADAR.roxo }}>
        ver cada movimento →
      </Link>
    </div>
  )
}

