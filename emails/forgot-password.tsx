// Email "Esqueci minha senha" — Sprint 1.5.
// Código 6 dígitos + validade 15 min + aviso anti-phishing.

import { EmailLayout, styles, EmailText, EmailHr } from './_layout'

interface ForgotPasswordEmailProps {
  userName: string
  code: string // 6 dígitos
  expiresInMinutes: number
  ipAddress?: string | null
}

export default function ForgotPasswordEmail({
  userName,
  code,
  expiresInMinutes,
  ipAddress,
}: ForgotPasswordEmailProps) {
  return (
    <EmailLayout preview={`Seu código de redefinição é ${code}`}>
      <h1 style={styles.heading}>Redefinir sua senha</h1>

      <EmailText style={styles.paragraph}>
        Olá, {userName}. Recebemos um pedido pra redefinir a senha da sua
        conta CAIXAOS. Use o código abaixo para continuar:
      </EmailText>

      <div style={styles.codeBox}>
        <p style={styles.codeText}>{code}</p>
      </div>

      <EmailText style={styles.paragraph}>
        Esse código expira em <strong>{expiresInMinutes} minutos</strong>.
        Digite ele na tela de redefinição.
      </EmailText>

      <EmailHr style={styles.hr} />

      <EmailText style={styles.smallText}>
        Se você <strong>não solicitou</strong> esta redefinição, pode
        ignorar este email — sua senha continua a mesma. Recomendamos
        revisar o acesso da sua conta caso veja outros emails parecidos.
        {ipAddress && (
          <>
            <br />
            Solicitação feita do IP <code>{ipAddress}</code>.
          </>
        )}
      </EmailText>
    </EmailLayout>
  )
}
