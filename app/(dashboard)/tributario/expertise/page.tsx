// Sprint 5.0.2.c.2 — Redirect 308 pra hub Tributário com tab Análise.

import { permanentRedirect } from 'next/navigation'

export default function ExpertiseRedirectPage() {
  permanentRedirect('/tributario?tab=analise')
}
