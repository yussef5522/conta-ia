// Sprint OFX V3 (27/06/2026) — endpoint pra UI consultar a flag

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { isOfxImportV3Enabled } from '@/lib/ofx-v3/feature-flag'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ enabled: false }, { status: 200 })
  }
  return NextResponse.json({ enabled: isOfxImportV3Enabled() })
}
