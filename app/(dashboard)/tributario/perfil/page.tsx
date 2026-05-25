// Sprint 5.0.2.c.2 — Redirect 308 pra hub Tributário com tab Config.

import { permanentRedirect } from 'next/navigation'

export default function PerfilRedirectPage() {
  permanentRedirect('/tributario?tab=config')
}
