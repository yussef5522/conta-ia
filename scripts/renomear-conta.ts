// ⭐ RENOMEAR A CONTA DO DONO (05/09/2026) — ordem dele: "todo rastro de decisão sai com o
// name, e as decisões são minhas".
//
// ⚠️ E O NOME ESTÁ DESNORMALIZADO em 5 tabelas do estoque (o "quem contou" aparece sem join).
// São SNAPSHOTS da mesma pessoa com o nome errado — corrigi-los é dizer a verdade sobre quem
// fez, não reescrever história. ⛔ Só troca onde o valor bate EXATO com o nome antigo, pra
// nunca encostar no rastro de outra pessoa.
//
// ⛔ SEM --apply NÃO GRAVA.
import { prisma } from "@/lib/db"

const EMAIL = "yussefmusa5522@gmail.com"
const NOVO = "Yussef Abu Zahry Musa"
const APLICAR = process.argv.includes("--apply")

async function main() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, name: true } })
  if (!u) throw new Error("Conta " + EMAIL + " não existe neste banco.")
  const antigo = u.name
  console.log("conta " + u.id + " · \"" + antigo + "\" → \"" + NOVO + "\"")

  const alvos = [
    ["stockContagem", "criadoPorNome"], ["stockContagemItem", "contadoPorNome"],
    ["stockContagemVersao", "contadoPorNome"], ["stockContagemRevisao", "decididoPorNome"],
    ["stockEntradaManual", "criadoPorNome"],
  ] as const
  console.log("")
  console.log("snapshots do nome antigo (mesma pessoa, nome errado):")
  let total = 0
  for (const [modelo, campo] of alvos) {
    // @ts-expect-error dinâmico
    const n = await prisma[modelo].count({ where: { [campo]: antigo } })
    total += n
    console.log("  " + modelo + "." + campo + ": " + n)
  }
  if (!APLICAR) { console.log("\n⛔ NADA FOI GRAVADO. Rode com --apply. (" + total + " snapshots + a conta)\n"); return }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: u.id }, data: { name: NOVO } })
    for (const [modelo, campo] of alvos) {
      // @ts-expect-error dinâmico
      await tx[modelo].updateMany({ where: { [campo]: antigo }, data: { [campo]: NOVO } })
    }
  })
  const depois = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { name: true } })
  console.log("")
  console.log("✓ conta renomeada: \"" + depois.name + "\" · " + total + " snapshot(s) corrigido(s)")
}
main().finally(() => prisma["\$disconnect"]())
