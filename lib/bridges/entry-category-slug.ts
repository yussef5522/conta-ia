// Sprint Entrada-Fixa-Ponte (13/08/2026) — constantes PURAS (sem prisma) do
// marcador estável da categoria de entrada da ponte. Ficam separadas pra o
// template de defaults (puro) e o helper server (entry-category.ts) usarem a
// MESMA fonte — sem risco de drift entre o seed e o get-or-create.

export const BRIDGE_ENTRY_SLUG = 'BRIDGE_ENTRY'
export const BRIDGE_ENTRY_DEFAULT_NAME = 'Retirada da empresa'
