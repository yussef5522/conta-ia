// Sprint 4.0.4 — função PURA que gera HTML do email de alertas.
// Sem React/JSX (template é simples + permite teste sem renderer).

import type { AlertasResult } from '@/lib/dashboard/alertas'

export interface AlertEmailInput {
  userName: string
  companyName: string
  alertas: AlertasResult
  dashboardUrl: string
  configUrl: string
}

export interface AlertEmailPayload {
  subject: string
  html: string
  // true quando nada relevante pra enviar (zero alertas)
  isEmpty: boolean
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAlertEmail(input: AlertEmailInput): AlertEmailPayload {
  const { alertas } = input
  const hasVencidas = alertas.vencidas.count > 0
  const has3Dias = alertas.vencendoEm3Dias.count > 0
  const hasSemana = alertas.vencendoSemana.count > 0

  if (!hasVencidas && !has3Dias && !hasSemana) {
    return { subject: '', html: '', isEmpty: true }
  }

  const totalCriticas = alertas.vencidas.total + alertas.vencendoEm3Dias.total
  const empresa = escapeHtml(input.companyName)

  // Subject prioriza vencidas (mais urgente)
  let subject: string
  if (hasVencidas) {
    subject = `🚨 ${alertas.vencidas.count} conta${alertas.vencidas.count === 1 ? '' : 's'} vencida${alertas.vencidas.count === 1 ? '' : 's'} — ${empresa}`
  } else if (has3Dias) {
    subject = `⚠️ ${alertas.vencendoEm3Dias.count} conta${alertas.vencendoEm3Dias.count === 1 ? '' : 's'} vence${alertas.vencendoEm3Dias.count === 1 ? '' : 'm'} em até 3 dias — ${empresa}`
  } else {
    subject = `📅 ${alertas.vencendoSemana.count} conta${alertas.vencendoSemana.count === 1 ? '' : 's'} essa semana — ${empresa}`
  }

  const rows: string[] = []

  if (hasVencidas) {
    rows.push(
      buildRow(
        '#dc2626',
        '🔴',
        `${alertas.vencidas.count} vencida${alertas.vencidas.count === 1 ? '' : 's'}`,
        alertas.vencidas.total,
      ),
    )
  }
  if (has3Dias) {
    rows.push(
      buildRow(
        '#d97706',
        '🟡',
        `${alertas.vencendoEm3Dias.count} vence${alertas.vencendoEm3Dias.count === 1 ? '' : 'm'} em até 3 dias`,
        alertas.vencendoEm3Dias.total,
      ),
    )
  }
  if (hasSemana) {
    rows.push(
      buildRow(
        '#52525b',
        '🟢',
        `${alertas.vencendoSemana.count} vence${alertas.vencendoSemana.count === 1 ? '' : 'm'} essa semana`,
        alertas.vencendoSemana.total,
      ),
    )
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Alertas CAIXAOS</title></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0a0a0a">
  <table style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;border-collapse:collapse" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 8px 0;font-size:18px;color:#0a0a0a">Olá, ${escapeHtml(input.userName)}</h1>
      <p style="margin:0 0 20px 0;color:#52525b;font-size:14px">
        Resumo de contas pendentes em <strong>${empresa}</strong>:
      </p>

      <table style="width:100%;border-collapse:collapse">${rows.join('')}</table>

      <div style="margin-top:24px;padding:16px;border-radius:6px;background:#185FA508;border:1px solid #185FA520">
        <p style="margin:0 0 4px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#52525b">Total crítico</p>
        <p style="margin:0;font-size:24px;font-weight:600;color:#0a0a0a;font-variant-numeric:tabular-nums">
          ${formatBRL(totalCriticas)}
        </p>
        <p style="margin:4px 0 0 0;font-size:11px;color:#52525b">Vencidas + vence em até 3 dias</p>
      </div>

      <div style="margin-top:24px;text-align:center">
        <a href="${input.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#185FA5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
          Ver no CAIXAOS
        </a>
      </div>

      <p style="margin:32px 0 0 0;text-align:center;font-size:11px;color:#a1a1aa">
        Você está recebendo este email porque ativou alertas em
        <a href="${input.configUrl}" style="color:#185FA5">configurações</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html, isEmpty: false }
}

function buildRow(color: string, icon: string, label: string, total: number): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6">
      <span style="color:${color};font-size:14px">${icon} ${escapeHtml(label)}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right">
      <strong style="color:${color};font-variant-numeric:tabular-nums">${formatBRL(total)}</strong>
    </td>
  </tr>`
}
