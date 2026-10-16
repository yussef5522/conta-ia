'use client'

/**
 * ⭐⭐ **A PERGUNTA DO DIA — uma, curta, com as duas opções na mão (16/10/2026).**
 *
 * *"esse relatório parece de quinta 15/10 — confirma?"* `[15/10] [16/10]`
 *
 * ⛔⛔ **UM COMPONENTE PRA OS DOIS RELATÓRIOS.** Produtos e complementos fazem a MESMA pergunta
 * sobre o MESMO par, e dois desenhos dela divergiriam no primeiro rótulo novo — que é
 * literalmente a classe de defeito que a lei da data existe pra fechar (dois caminhos decidindo
 * o dia por conta própria).
 *
 * ⛔ **E ELE NÃO DECIDE NADA.** A frase, as opções e a ordem delas vêm do SERVIDOR
 * (`avaliarDiaDoRelatorio`): se a tela montasse o texto ou escolhesse a aposta, seria a 2ª
 * régua da pergunta, e ela poderia oferecer um dia que a gravação recusa.
 *
 * ⚠️ **Dia FUTURO chega com `opcoes: []`** — e aí o componente mostra só a frase, sem botão.
 * Botão que não resolve nada é ruído (e ali não há o que confirmar: o dia não aconteceu).
 */
export interface VeredictoDoDia {
  decisao: 'ACEITA' | 'PERGUNTA' | 'RECUSA'
  dia: string
  frase: string | null
  opcoes: { dia: string; rotulo: string }[]
  porque: string
}

export function PerguntaDoDia({
  veredicto,
  onEscolher,
  onCancelar,
  ocupado,
}: {
  veredicto: VeredictoDoDia
  /** ⭐ reenvia o MESMO gesto com `confirmouDia` — nunca uma 2ª porta de gravação */
  onEscolher: (dia: string) => void
  onCancelar: () => void
  ocupado?: boolean
}) {
  const recusa = veredicto.decisao === 'RECUSA'
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor: recusa ? 'var(--fam-coral-mid)' : 'var(--fam-ambar-mid)',
        background: recusa ? 'var(--fam-coral-bg)' : 'var(--fam-ambar-bg)',
      }}
      role={recusa ? 'alert' : 'group'}
      aria-label="confirme o dia deste relatório"
    >
      <p className="text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>
        {veredicto.frase}
      </p>
      {veredicto.opcoes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {veredicto.opcoes.map((o, k) => (
            <button
              key={o.dia}
              type="button"
              disabled={ocupado}
              onClick={() => onEscolher(o.dia)}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50"
              style={
                /** ⭐ a APOSTA da lei vem primeiro e vem destacada — a 2ª é a saída */
                k === 0
                  ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
                  : { border: '1px solid var(--prod-line)', color: 'var(--prod-primary)' }
              }
            >
              {o.rotulo}
            </button>
          ))}
          <button
            type="button"
            onClick={onCancelar}
            className="text-[12px] underline"
            style={{ color: 'var(--prod-muted)' }}
          >
            agora não
          </button>
        </div>
      )}
    </div>
  )
}
