'use client'
// ⭐⭐ CARTÕES v3 (R45, 24/11/2026) — EDITAR CARTÃO, ligado no PATCH que já existia e nenhum botão
// chamava. ⛔ Limite e dias errados não tinham como ser corrigidos pela tela; e a regra do dia do
// fechamento (ATUAL/PRÓXIMA) nunca teve campo — sempre nascia "ATUAL".

import { useState } from 'react'
import type { CartaoNaCarteira } from '@/lib/credit-card-pj/carteira'
import { SOMBRA } from './visual'

const BANDEIRAS = ['', 'VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD']
const ROTULO_BANDEIRA: Record<string, string> = { '': '—', VISA: 'Visa', MASTERCARD: 'Mastercard', ELO: 'Elo', AMEX: 'American Express', HIPERCARD: 'Hipercard' }

export function EditarCartao({ k, gravando, onFechar, onSalvar }: {
  k: CartaoNaCarteira
  gravando: boolean
  onFechar: () => void
  onSalvar: (body: Record<string, unknown>) => void
}) {
  const [f, setF] = useState({
    name: k.name, bankName: k.bankName ?? '', brand: (k.brand ?? '').toUpperCase(), lastDigits: k.lastDigits ?? '',
    creditLimit: String(k.creditLimit).replace('.', ','), closingDay: String(k.closingDay), dueDay: String(k.dueDay),
    closingDayRule: k.closingDayRule === 'PROXIMA' ? 'PROXIMA' : 'ATUAL',
    estado: k.encerradoEm ? 'ENCERRADO' : 'ATIVO',
  })
  const [erro, setErro] = useState<string | null>(null)
  const set = (c: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [c]: e.target.value }))

  function salvar() {
    const limite = Number(f.creditLimit.replace(/\./g, '').replace(',', '.'))
    const fecha = Number(f.closingDay)
    const vence = Number(f.dueDay)
    if (!f.name.trim()) return setErro('Dê um nome pro cartão.')
    if (!(limite > 0)) return setErro('O limite tem que ser maior que zero.')
    if (!Number.isInteger(fecha) || fecha < 1 || fecha > 31 || !Number.isInteger(vence) || vence < 1 || vence > 31) return setErro('Os dias vão de 1 a 31.')
    if (fecha === vence) return setErro('O dia de vencimento não pode ser igual ao de fechamento.')
    if (f.lastDigits && !/^\d{2,6}$/.test(f.lastDigits)) return setErro('Os últimos dígitos são só números (2 a 6).')
    setErro(null)
    onSalvar({
      name: f.name.trim(), bankName: f.bankName.trim() || null, brand: f.brand || null, lastDigits: f.lastDigits || null,
      creditLimit: limite, closingDay: fecha, dueDay: vence, closingDayRule: f.closingDayRule,
      encerrado: f.estado === 'ENCERRADO',
    })
  }

  const campo = 'mt-1 h-10 w-full min-w-0 rounded-[10px] border px-3 text-[13px] font-bold'
  const estilo = { borderColor: 'var(--esc-linha)', background: 'var(--esc-card)', color: 'var(--esc-tinta)' }
  const rot = 'block text-[11px] font-extrabold'
  return (
    <div role="dialog" aria-modal="true" aria-label="editar cartão" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !gravando && onFechar()}>
      <div data-testid="editar-cartao" className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] p-5" style={{ background: 'var(--esc-card)', ...SOMBRA }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-extrabold" style={{ color: 'var(--esc-tinta)' }}>Editar cartão</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={`${rot} sm:col-span-2`} style={{ color: 'var(--esc-tinta2)' }}>Nome do cartão
            <input className={campo} style={estilo} value={f.name} onChange={set('name')} /></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Banco emissor
            <input className={campo} style={estilo} value={f.bankName} onChange={set('bankName')} /></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Bandeira
            <select className={campo} style={estilo} value={f.brand} onChange={set('brand')}>
              {BANDEIRAS.map((b) => <option key={b} value={b}>{ROTULO_BANDEIRA[b]}</option>)}
            </select></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Últimos dígitos
            <input className={campo} style={estilo} inputMode="numeric" value={f.lastDigits} onChange={set('lastDigits')} /></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Limite total (R$)
            <input className={`${campo} num`} style={estilo} inputMode="decimal" value={f.creditLimit} onChange={set('creditLimit')} /></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Dia do fechamento
            <input className={`${campo} num`} style={estilo} inputMode="numeric" value={f.closingDay} onChange={set('closingDay')} /></label>
          <label className={rot} style={{ color: 'var(--esc-tinta2)' }}>Dia do vencimento
            <input className={`${campo} num`} style={estilo} inputMode="numeric" value={f.dueDay} onChange={set('dueDay')} /></label>
          <label className={`${rot} sm:col-span-2`} style={{ color: 'var(--esc-tinta2)' }}>Compra feita no dia do fechamento entra
            <select className={campo} style={estilo} value={f.closingDayRule} onChange={set('closingDayRule')}>
              <option value="ATUAL">nesta fatura</option>
              <option value="PROXIMA">na próxima fatura</option>
            </select></label>
          <label className={`${rot} sm:col-span-2`} style={{ color: 'var(--esc-tinta2)' }}>Estado do cartão
            <select data-testid="estado-do-cartao" className={campo} style={estilo} value={f.estado} onChange={set('estado')}>
              <option value="ATIVO">Ativo</option>
              <option value="ENCERRADO">Encerrado (cancelado no banco — só pago as parcelas que ficaram)</option>
            </select></label>
          {f.estado === 'ENCERRADO' && (
            <p className="text-[11.5px] font-bold sm:col-span-2" style={{ color: 'var(--esc-tinta3)' }}>
              Encerrar não apaga nada e não é arquivar: o cartão continua na página até a última parcela, sai da conta do limite e ganha a fatura de quitação de cada mês.
            </p>
          )}
        </div>
        {erro && <p className="mt-3 text-[12.5px] font-bold" style={{ color: 'var(--esc-perigo)' }}>{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={gravando} onClick={onFechar} className="h-9 rounded-[10px] px-4 text-[13px] font-extrabold" style={{ background: 'var(--esc-trilho)', color: 'var(--esc-tinta2)' }}>Cancelar</button>
          <button type="button" disabled={gravando} onClick={salvar} className="h-9 rounded-[10px] px-4 text-[13px] font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>{gravando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
