// Layout base compartilhado pelos emails CAIXAOS — Sprint 1.5.
// Mobile-friendly (max-width 600px), dark-mode safe, branding consistente
// com Sprint 1.2/1.4 (logo Chart + paleta #0C447C).

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

interface BaseEmailProps {
  preview: string
  children: ReactNode
}

const main = {
  backgroundColor: '#f6f8fb',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '32px 16px',
}

const card = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '32px 28px',
  boxShadow: '0 1px 3px rgba(12, 68, 124, 0.06)',
  border: '1px solid rgba(12, 68, 124, 0.08)',
}

const brandRow = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '24px',
}

const brandText = {
  fontSize: '18px',
  fontWeight: '500',
  color: '#0C447C',
  letterSpacing: '-0.2px',
  margin: 0,
}

const footer = {
  marginTop: '24px',
  padding: '0 8px',
  textAlign: 'center' as const,
}

const footerText = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '4px 0',
}

// SVG Logo Chart inline (mesmo do Sprint 1.2).
// Inline porque emails não carregam fontes/scripts externos.
function BrandLogo() {
  return (
    <table cellPadding={0} cellSpacing={0} border={0} style={brandRow}>
      <tr>
        <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://app.caixaos.com.br/logo-chart.png"
            alt="CAIXAOS"
            width="36"
            height="36"
            style={{ display: 'block', borderRadius: '9px' }}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <p style={brandText}>CAIXAOS</p>
        </td>
      </tr>
    </table>
  )
}

export function EmailLayout({ preview, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <BrandLogo />
            {children}
          </Section>

          <div style={footer}>
            <Text style={footerText}>
              CAIXAOS · A IA que organiza teu caixa em segundos
            </Text>
            <Text style={footerText}>
              Você recebeu este email porque tem uma conta no CAIXAOS.
            </Text>
          </div>
        </Container>
      </Body>
    </Html>
  )
}

export {
  // Re-exports pra templates filhos usarem
  Section as EmailSection,
  Text as EmailText,
  Hr as EmailHr,
}

export const styles = {
  heading: {
    fontSize: '22px',
    fontWeight: '500',
    color: '#0C447C',
    margin: '0 0 8px 0',
    letterSpacing: '-0.3px',
  },
  paragraph: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6',
    margin: '0 0 16px 0',
  },
  smallText: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.5',
    margin: '0',
  },
  buttonContainer: {
    margin: '24px 0',
    textAlign: 'center' as const,
  },
  button: {
    display: 'inline-block',
    backgroundColor: '#185FA5',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    padding: '12px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
  },
  codeBox: {
    background: 'linear-gradient(135deg, rgba(12,68,124,0.06) 0%, rgba(24,95,165,0.10) 100%)',
    border: '1px solid rgba(12, 68, 124, 0.2)',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center' as const,
    margin: '20px 0',
  },
  codeText: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#0C447C',
    letterSpacing: '0.4em',
    margin: '0',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid rgba(12, 68, 124, 0.08)',
    margin: '24px 0',
  },
  link: {
    color: '#185FA5',
    textDecoration: 'underline',
  },
}
