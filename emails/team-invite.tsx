// Email "Você foi convidado(a)" — Sprint 1.5.
// Substitui o copy-link manual da Sprint 1.4.

import { EmailLayout, styles, EmailText, EmailHr } from './_layout'

interface TeamInviteEmailProps {
  inviteeName?: string | null // opcional (pode não saber o nome)
  inviterName: string
  companyName: string
  roleName: string
  roleDescription?: string | null
  inviteUrl: string
  expiresInDays: number
}

export default function TeamInviteEmail({
  inviteeName,
  inviterName,
  companyName,
  roleName,
  roleDescription,
  inviteUrl,
  expiresInDays,
}: TeamInviteEmailProps) {
  const greeting = inviteeName ? `Olá, ${inviteeName}` : 'Olá'

  return (
    <EmailLayout
      preview={`${inviterName} te convidou para ${companyName} no CAIXAOS`}
    >
      <h1 style={styles.heading}>Você foi convidado(a)</h1>

      <EmailText style={styles.paragraph}>
        {greeting}. <strong>{inviterName}</strong> te convidou para fazer
        parte do time de <strong>{companyName}</strong> no CAIXAOS.
      </EmailText>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid rgba(12, 68, 124, 0.10)',
          borderRadius: '10px',
          padding: '16px 18px',
          margin: '20px 0',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#64748b',
            margin: '0 0 4px 0',
          }}
        >
          Seu papel
        </p>
        <p
          style={{
            fontSize: '15px',
            fontWeight: '500',
            color: '#0C447C',
            margin: '0 0 6px 0',
          }}
        >
          {roleName}
        </p>
        {roleDescription && (
          <p
            style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            {roleDescription}
          </p>
        )}
      </div>

      <div style={styles.buttonContainer}>
        <a href={inviteUrl} style={styles.button}>
          Aceitar convite
        </a>
      </div>

      <EmailText style={styles.smallText}>
        Esse convite expira em <strong>{expiresInDays} dias</strong>. Se o
        botão acima não funcionar, copie e cole esse link no navegador:
        <br />
        <a href={inviteUrl} style={styles.link}>
          {inviteUrl}
        </a>
      </EmailText>

      <EmailHr style={styles.hr} />

      <EmailText style={styles.smallText}>
        Não conhece <strong>{inviterName}</strong> ou não esperava esse
        convite? Pode ignorar este email — o link expira sozinho.
      </EmailText>
    </EmailLayout>
  )
}
