// Render helpers de templates de email — Sprint 1.5.
// Wrappa @react-email/render pra simplificar uso nos endpoints.

import { render } from '@react-email/render'
import { createElement } from 'react'
import ForgotPasswordEmail from '@/emails/forgot-password'
import TeamInviteEmail from '@/emails/team-invite'
import WelcomeEmail from '@/emails/welcome'

export async function renderForgotPasswordHtml(props: {
  userName: string
  code: string
  expiresInMinutes: number
  ipAddress?: string | null
}): Promise<string> {
  return await render(createElement(ForgotPasswordEmail, props))
}

export async function renderTeamInviteHtml(props: {
  inviteeName?: string | null
  inviterName: string
  companyName: string
  roleName: string
  roleDescription?: string | null
  inviteUrl: string
  expiresInDays: number
}): Promise<string> {
  return await render(createElement(TeamInviteEmail, props))
}

export async function renderWelcomeHtml(props: {
  userName: string
  appUrl: string
}): Promise<string> {
  return await render(createElement(WelcomeEmail, props))
}
