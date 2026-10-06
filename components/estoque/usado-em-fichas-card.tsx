'use client'

/**
 * ⭐⭐⭐ "USADO EM N FICHAS" — o cartão da BUSCA REVERSA (06/10/2026).
 *
 * **Ordem do dono:** *"Cartão listando TODA ficha (produção e cardápio) que contém o item:
 * logo da ficha + nome + tipo + «DOSE do item nesta ficha» escrita por extenso + versão +
 * [abrir ficha →]"*, com a dose destoante em linha vermelha e `[corrigir agora →]`.
 *
 * ⛔ A DECISÃO DE QUEM É SUSPEITO **NÃO MORA AQUI** — ela vem do servidor (`usadoEmFichas`),
 * pela régua da mediana das irmãs. A tela só desenha: se ela derivasse, seriam duas respostas
 * pra *"esta dose está estranha?"* e elas divergiriam no 1º ajuste do fator.
 */
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, ArrowRight, ChefHat } from 'lucide-react'
import { LogoDaReceita } from '@/components/estoque/logo-da-receita'
import type { UsadoEmFichas } from '@/lib/stock/item/usado-em-fichas'

export function UsadoEmFichasCard({ uso, nomeDoItem }: { uso: UsadoEmFichas; nomeDoItem: string }) {
  const { fichas, suspeitas } = uso
  return (
    <Card style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line)' }}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <ChefHat className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>
            {fichas.length === 0 ? 'Receitas que usam este item' : `Usado em ${fichas.length} ficha${fichas.length > 1 ? 's' : ''}`}
          </h2>
          {suspeitas > 0 && (
            <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
              style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>
              {suspeitas} dose{suspeitas > 1 ? 's' : ''} suspeita{suspeitas > 1 ? 's' : ''}
            </span>
          )}
          <p className="hidden flex-1 truncate text-[11.5px] lg:block" style={{ color: 'var(--prod-muted)' }}>
            quanto de {nomeDoItem} cada receita consome
          </p>
        </div>

        {/*
          ⛔ AUSÊNCIA É INFORMAÇÃO (ordem do dono): *"item sem ficha: «nenhuma ficha usa este
          item» (que também é informação — revenda puro)"*. Cartão vazio sem frase deixaria o
          dono achando que a tela não carregou.
        */}
        {fichas.length === 0 ? (
          <p className="px-4 pb-4 text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
            Nenhuma ficha ativa usa este item — ele entra e sai do estoque sem passar por receita
            (é o caso da revenda pura). Se ele deveria ser ingrediente de algo, a dose se cadastra
            na ficha da receita.
          </p>
        ) : (
          <ul>
            {fichas.map((f) => (
              <li key={f.fichaId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-4 py-2.5"
                style={{
                  borderColor: 'var(--prod-line)',
                  // ⚠️ o chão só muda na suspeita — zebrado + vermelho competiriam pelo olho
                  background: f.suspeita ? 'var(--fam-coral-bg)' : undefined,
                }}>
                <LogoDaReceita nome={f.nome} tamanho={32} alerta={f.suspeita ? { titulo: f.suspeita.frase } : null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>{f.nome}</p>
                  <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {f.tipoLabel} · v{f.versao}
                  </p>
                </div>
                {/* ⭐ A DOSE é o número que o dono vem conferir — peso tipográfico nela */}
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-semibold tabular-nums" style={{ color: f.suspeita ? 'var(--fam-coral-ink)' : 'var(--prod-primary)' }}>
                    {f.doseTexto}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>por receita</p>
                </div>
                {f.suspeita ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[11.5px] leading-snug" style={{ color: 'var(--fam-coral-ink)' }}>
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {f.suspeita.frase}
                    </p>
                    {/* ⭐ a porta leva DIRETO na dose (o editor acende a linha do componente) */}
                    <a href={f.hrefCorrigir}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold"
                      style={{ background: 'var(--prod-surface)', color: 'var(--fam-coral-ink)', boxShadow: 'inset 0 0 0 1px var(--fam-coral-mid)' }}>
                      corrigir agora <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <a href={f.href}
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium"
                    style={{ color: 'var(--prod-accent)' }}>
                    abrir ficha <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
