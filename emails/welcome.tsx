// Email de boas-vindas — Sprint 1.5.
// Enviado fire-and-forget após cadastro. Não bloqueia signup.

import { EmailLayout, styles, EmailText, EmailHr } from './_layout'

interface WelcomeEmailProps {
  userName: string
  appUrl: string
}

export default function WelcomeEmail({ userName, appUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Bem-vindo(a) ao CAIXAOS!">
      <h1 style={styles.heading}>Bem-vindo(a) ao CAIXAOS, {userName}!</h1>

      <EmailText style={styles.paragraph}>
        Sua conta foi criada com sucesso. O CAIXAOS é a IA Contadora que
        organiza teu financeiro em segundos — importa OFX, categoriza
        sozinha, gera DRE, e detecta padrões nas tuas transações.
      </EmailText>

      <div style={styles.buttonContainer}>
        <a href={appUrl} style={styles.button}>
          Entrar no painel
        </a>
      </div>

      <EmailHr style={styles.hr} />

      <p
        style={{
          fontSize: '13px',
          fontWeight: '500',
          color: '#0C447C',
          margin: '8px 0',
        }}
      >
        Próximos passos
      </p>

      <ol
        style={{
          paddingLeft: '20px',
          margin: 0,
          color: '#475569',
          fontSize: '13px',
          lineHeight: '1.8',
        }}
      >
        <li>Cadastre sua empresa (CNPJ + tipo de negócio)</li>
        <li>Crie ou conecte sua conta bancária</li>
        <li>Importe seu primeiro OFX — a IA classifica em segundos</li>
        <li>Convide o time pra colaborar</li>
      </ol>

      <EmailHr style={styles.hr} />

      <EmailText style={styles.smallText}>
        Qualquer dúvida, responde esse email — a gente lê tudo.
      </EmailText>
    </EmailLayout>
  )
}
