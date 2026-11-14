'use client'

// ⭐⭐ O QUE AS 4 TELAS DA PRODUÇÃO DIVIDEM (leis R1–R24, 13/11/2026) — tema escritório claro (--esc-*),
// a mesma família do Painel v9. Tokens POR VALOR, copiados das referências em docs/ (o guard de UI
// abre as leis e compara). Chips da R1: Painel · Ao vivo · Desempenho · Receitas · Equipe.
// Estados honestos: vazio diz o que falta; falha de leitura diz que falhou e oferece "tentar de novo".

import type { ReactNode } from 'react'

/** ⭐ os tokens --esc-* moram em app/globals.css (claro e escuro) — aqui só se USA var(--esc-*) */

/** o CSS comum (prefixo rx-) — cada tela soma o seu */
export const CSS_COMUM = `
.rx{background:var(--esc-bg);color:var(--esc-tinta);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100%}
.rx .num{font-variant-numeric:tabular-nums}
.rx-wrap{max-width:1180px;margin:0 auto;padding:6px 2px 30px}
.rx-top{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.rx-top h1{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em}
.rx-chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 18px}
.rx-chips a{display:inline-flex;align-items:center;border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);
  border-radius:999px;height:34px;padding:0 15px;font-size:12.5px;font-weight:800;text-decoration:none}
.rx-chips a.on{background:var(--esc-indigo);border-color:var(--esc-indigo);color:var(--esc-on)}
.rx-card{background:var(--esc-card);border:1px solid var(--esc-linha);border-radius:14px;padding:14px 16px;margin-bottom:16px}
.rx-chead{display:flex;align-items:center;gap:8px;font-size:9.5px;font-weight:800;letter-spacing:.08em;color:var(--esc-tinta3);text-transform:uppercase;margin-bottom:4px;flex-wrap:wrap}
.rx-chead .n{background:var(--esc-indigo50);color:var(--esc-indigo-t);border-radius:999px;padding:1px 8px;font-size:10.5px;letter-spacing:0}
.rx-chead .sp{flex:1}
.rx-chead a{color:var(--esc-indigo);font-size:11.5px;font-weight:800;letter-spacing:0;text-transform:none;text-decoration:none}
.rx-iwr{position:relative;display:inline-flex}
.rx-i{width:17px;height:17px;border-radius:50%;border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta3);font-size:10.5px;font-weight:800;cursor:pointer;line-height:1;display:inline-flex;align-items:center;justify-content:center;padding:0}
.rx-pop{display:none;position:absolute;top:22px;left:-8px;z-index:9;width:260px;max-width:78vw;background:var(--esc-pop);color:var(--esc-pop-t);border-radius:10px;padding:10px 12px;font-size:11.5px;font-weight:600;line-height:1.5;letter-spacing:0;text-transform:none}
.rx-iwr.aberto .rx-pop{display:block}
.rx-avt{width:34px;height:34px;border-radius:50%;background:var(--esc-indigo50);color:var(--esc-indigo-t);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
.rx-bar{height:4px;border-radius:99px;background:var(--esc-trilho);margin-top:6px;overflow:hidden}
.rx-bar i{display:block;height:100%;border-radius:99px;background:var(--esc-indigo)}
.rx-badge-t{display:inline-block;background:var(--esc-roxo50);color:var(--esc-roxo-t);border-radius:6px;padding:1px 7px;font-size:10px;font-weight:800;letter-spacing:.05em;margin-right:6px;vertical-align:1px}
.rx-ver{color:var(--esc-indigo);font-size:11.5px;font-weight:800;text-decoration:none;white-space:nowrap;background:none;border:0;cursor:pointer;padding:0}
.rx-vazio{font-size:12.5px;font-weight:600;color:var(--esc-tinta2);padding:14px 0}
.rx-falhou{border-left:3px solid var(--esc-ambar);background:var(--esc-ambar50);color:var(--esc-ambar-t);border-radius:0 10px 10px 0;padding:10px 12px;font-size:12.5px;font-weight:700;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.rx-falhou button{border:1px solid var(--esc-ambar);background:var(--esc-card);color:var(--esc-ambar-t);border-radius:8px;height:30px;padding:0 12px;font-size:12px;font-weight:800;cursor:pointer}
.rx-btn{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta);border-radius:9px;height:32px;padding:0 14px;font-size:12px;font-weight:800;cursor:pointer}
.rx-btn.pri{background:var(--esc-indigo);border-color:var(--esc-indigo);color:var(--esc-on)}
.rx-btn.perigo{color:var(--esc-perigo);border-color:var(--esc-perigo-linha)}
.rx-btn.mata{background:var(--esc-perigo);border-color:var(--esc-perigo);color:var(--esc-on)}
.rx-btn:disabled{opacity:.55;cursor:default}
`

export type AbaDaProducao = 'painel' | 'ao-vivo' | 'desempenho' | 'receitas' | 'equipe' | 'rotinas'

/** ⭐ R1 — os chips da produção, na ordem da lei (13/11: Rotinas entra em 6º — docs/rotinas-referencia.html) */
export const CHIPS_DA_PRODUCAO: { aba: AbaDaProducao; rotulo: string; caminho: string }[] = [
  { aba: 'painel', rotulo: 'Painel', caminho: '' },
  { aba: 'ao-vivo', rotulo: 'Ao vivo', caminho: '/ao-vivo' },
  { aba: 'desempenho', rotulo: 'Desempenho', caminho: '/desempenho' },
  { aba: 'receitas', rotulo: 'Receitas', caminho: '/receitas' },
  { aba: 'equipe', rotulo: 'Equipe', caminho: '/equipe' },
  { aba: 'rotinas', rotulo: 'Rotinas', caminho: '/rotinas' },
]

export function ChipsDaProducao({ empresaId, aba, className = 'rx-chips', extra }: { empresaId: string; aba: AbaDaProducao | null; className?: string; extra?: ReactNode }) {
  return (
    <nav className={className} data-testid="chips-da-producao">
      {CHIPS_DA_PRODUCAO.map((c) => (
        <a key={c.aba} className={c.aba === aba ? 'on' : undefined} aria-current={c.aba === aba ? 'page' : undefined}
          href={`/empresas/${empresaId}/estoque/producao${c.caminho}`}>{c.rotulo}</a>
      ))}
      {extra}
    </nav>
  )
}

/** ⭐ falha de leitura NUNCA vira tela vazia: diz que falhou e oferece tentar de novo */
export function FalhouDeLer({ onTentar, oQue }: { onTentar: () => void; oQue: string }) {
  return (
    <div className="rx-falhou" role="alert" data-testid="leitura-falhou">
      Não consegui ler {oQue} agora — o que está na tela pode estar desatualizado.
      <button type="button" onClick={onTentar} data-testid="tentar-de-novo">tentar de novo</button>
    </div>
  )
}

export function Info({ children }: { children: ReactNode }) {
  return (
    <span className="rx-iwr">
      <button type="button" className="rx-i" aria-label="como ler" onClick={(e) => (e.currentTarget.parentElement as HTMLElement).classList.toggle('aberto')}>i</button>
      <span className="rx-pop">{children}</span>
    </span>
  )
}

/** GET com prazo: devolve o JSON ou LANÇA (status ≠ 2xx, rede, 15s) — quem chama mostra `FalhouDeLer` */
export async function lerJson<T>(url: string, ms = 15_000): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()) as T
  } finally { clearTimeout(t) }
}
