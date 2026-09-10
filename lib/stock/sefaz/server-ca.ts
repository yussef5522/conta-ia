// ESTOQUE FASE 0 item 2 — CAs pra VERIFICAR O SERVIDOR da SEFAZ (não confundir com o
// cert do cliente). O Node só traz o bundle Mozilla; o emissor do servidor da SEFAZ
// (cadeia ICP/gov) pode não estar lá — o curl confia porque usa o bundle do SISTEMA.
// Une os roots do Node + o bundle do sistema (o que o curl usa). Cacheado.

import { readFileSync } from 'node:fs'
import tls from 'node:tls'

const SYSTEM_CA_PATHS = [
  '/etc/ssl/certs/ca-certificates.crt', // Debian/Ubuntu (o CAIXAOS)
  '/etc/pki/tls/certs/ca-bundle.crt', // RHEL/CentOS
  '/etc/ssl/ca-bundle.pem', // SUSE
]

let cache: string[] | null = null

/** Roots do Node + bundle do sistema (dedup por PEM). NUNCA vazio (cai nos roots do Node). */
export function loadServerCa(): string[] {
  if (cache) return cache
  const set = new Set<string>(tls.rootCertificates)
  for (const p of SYSTEM_CA_PATHS) {
    try {
      // ⛔⛔ O `turbopackIgnore` NÃO é enfeite (10/09/2026): sem ele o Turbopack não
      // consegue resolver este caminho estaticamente, avisa *"a file was traced that
      // indicates that the WHOLE PROJECT was traced unintentionally"* e **rastreia o
      // projeto inteiro** pra dentro da lista NFT. O build passou a estourar a heap do V8
      // no servidor — duas vezes seguidas, com prod salvo só pelo blue-green.
      // ⚠️ São caminhos ABSOLUTOS do SO (o bundle de CA que o curl usa); não há nada do
      // projeto pra rastrear aqui.
      const raw = readFileSync(/* turbopackIgnore: true */ p, 'utf8')
      for (const m of raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []) {
        set.add(m.trim())
      }
      break // achou um bundle do sistema, basta
    } catch {
      // caminho não existe nesse SO — tenta o próximo
    }
  }
  cache = [...set]
  return cache
}
