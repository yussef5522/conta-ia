import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { aplicarTemplate } from '../lib/categories/defaults'

const prisma = new PrismaClient()

async function seedCategories(companyId: string, companyType: string) {
  // Usa o aplicarTemplate (idempotente) que respeita hierarquia + DRE groups +
  // códigos SPED + visibleInRegimes do template profissional do subsetor.
  await aplicarTemplate(prisma, companyId, companyType)
}

async function main() {
  console.log('Iniciando seed...')

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

  // Empresa de exemplo para testar
  const empresa = await prisma.company.upsert({
    where: { cnpj: '00000000000191' },
    update: {},
    create: {
      cnpj: '00000000000191',
      name: 'Empresa Demonstração Ltda',
      tradeName: 'Demo Conta IA',
      type: 'SERVICE',
      taxRegime: 'SIMPLES_NACIONAL',
      users: { create: { userId: admin.id, role: 'OWNER' } },
    },
  })

  await seedCategories(empresa.id, empresa.type)
  console.log(`Empresa de demonstração criada: ${empresa.tradeName}`)
  console.log(`Categorias padrão criadas para o setor: ${empresa.type}`)

  console.log('\nSeed concluído!')
  console.log('Login: admin@contaia.com.br / ContaIA@2025')
}

main()
  .catch((e) => { console.error('Erro no seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
