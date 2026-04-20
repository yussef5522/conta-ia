import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  // Usuário admin (Yussef)
  const senhaHash = await bcrypt.hash('ContaIA@2025', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@contaia.com.br' },
    update: {},
    create: {
      name: 'Yussef Musa',
      email: 'admin@contaia.com.br',
      password: senhaHash,
      role: 'ADMIN',
    },
  })

  console.log(`Usuário criado: ${admin.email}`)
  console.log(`Senha inicial: ContaIA@2025`)
  console.log('\nSeed concluído com sucesso!')
}

main()
  .catch((error) => {
    console.error('Erro no seed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
