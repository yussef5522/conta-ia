// Schema + migration de cupons — Sprint 1.7.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'

const couponModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Coupon')
const redemptionModel = Prisma.dmmf.datamodel.models.find(
  (m) => m.name === 'CouponRedemption',
)
const auditModel = Prisma.dmmf.datamodel.models.find(
  (m) => m.name === 'GerenciadorAuditLog',
)

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260519000001_add_coupons_and_nullable_admin_audit',
  'migration.sql',
)
const sql = readFileSync(migrationPath, 'utf-8')

describe('Coupon model — Sprint 1.7', () => {
  it('modelo existe no schema', () => {
    expect(couponModel).toBeDefined()
  })

  it('code é UNIQUE', () => {
    const codeField = couponModel!.fields.find((f) => f.name === 'code')!
    expect(codeField.isUnique).toBe(true)
  })

  it('type é String (enum stringly-typed por consistência do projeto)', () => {
    const typeField = couponModel!.fields.find((f) => f.name === 'type')!
    expect(typeField.type).toBe('String')
    expect(typeField.isRequired).toBe(true)
  })

  it('value é Decimal', () => {
    const valueField = couponModel!.fields.find((f) => f.name === 'value')!
    expect(valueField.type).toBe('Decimal')
  })

  it('freeMonths é Int? opcional', () => {
    const f = couponModel!.fields.find((f) => f.name === 'freeMonths')!
    expect(f.type).toBe('Int')
    expect(f.isRequired).toBe(false)
  })

  it('maxUses é Int? opcional (null = ilimitado)', () => {
    const f = couponModel!.fields.find((f) => f.name === 'maxUses')!
    expect(f.isRequired).toBe(false)
  })

  it('maxUsesPerUser default 1', () => {
    const f = couponModel!.fields.find((f) => f.name === 'maxUsesPerUser')!
    expect(f.hasDefaultValue).toBe(true)
  })

  it('currentUses default 0', () => {
    const f = couponModel!.fields.find((f) => f.name === 'currentUses')!
    expect(f.hasDefaultValue).toBe(true)
  })

  it('status default ACTIVE', () => {
    const f = couponModel!.fields.find((f) => f.name === 'status')!
    expect(f.hasDefaultValue).toBe(true)
  })
})

describe('CouponRedemption model — Sprint 1.7', () => {
  it('modelo existe', () => {
    expect(redemptionModel).toBeDefined()
  })

  it('@@unique([couponId, userId]) garante 1 resgate por usuário', () => {
    const uniqueIdx = redemptionModel!.uniqueIndexes.find((u) =>
      u.fields.includes('couponId') && u.fields.includes('userId'),
    )
    expect(uniqueIdx).toBeDefined()
  })

  it('snapshot fields preservam o cupom à época do resgate', () => {
    const codeSnap = redemptionModel!.fields.find((f) => f.name === 'codeSnapshot')!
    const typeSnap = redemptionModel!.fields.find((f) => f.name === 'typeSnapshot')!
    const valueSnap = redemptionModel!.fields.find((f) => f.name === 'valueSnapshot')!
    expect(codeSnap.type).toBe('String')
    expect(typeSnap.type).toBe('String')
    expect(valueSnap.type).toBe('Decimal')
    expect(codeSnap.isRequired).toBe(true)
    expect(typeSnap.isRequired).toBe(true)
    expect(valueSnap.isRequired).toBe(true)
  })
})

describe('GerenciadorAuditLog.gerenciadorId nullable — D11', () => {
  it('campo agora é opcional (eventos de sistema)', () => {
    const f = auditModel!.fields.find((f) => f.name === 'gerenciadorId')!
    expect(f.isRequired).toBe(false)
  })
})

describe('Migration SQL Postgres', () => {
  it('DROP CONSTRAINT do FK antigo', () => {
    expect(sql).toMatch(
      /ALTER TABLE "gerenciador_audit_log"[\s\S]*DROP CONSTRAINT "gerenciador_audit_log_gerenciadorId_fkey"/,
    )
  })

  it('DROP NOT NULL em gerenciadorId', () => {
    expect(sql).toMatch(
      /ALTER COLUMN "gerenciadorId" DROP NOT NULL/,
    )
  })

  it('CREATE TABLE coupons', () => {
    expect(sql).toMatch(/CREATE TABLE "coupons"/)
    expect(sql).toMatch(/"value"\s+DECIMAL\(10, 2\)/)
  })

  it('UNIQUE index em coupons.code', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "coupons_code_key"/)
  })

  it('CREATE TABLE coupon_redemptions com UNIQUE(couponId, userId)', () => {
    expect(sql).toMatch(/CREATE TABLE "coupon_redemptions"/)
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "coupon_redemptions_couponId_userId_key"/,
    )
  })

  it('FK couponId ON DELETE RESTRICT (preserva audit)', () => {
    expect(sql).toMatch(
      /FOREIGN KEY \("couponId"\) REFERENCES "coupons"\("id"\)[\s\S]*ON DELETE RESTRICT/,
    )
  })

  it('FK userId ON DELETE CASCADE (LGPD — apaga junto)', () => {
    expect(sql).toMatch(
      /FOREIGN KEY \("userId"\) REFERENCES "users"\("id"\)[\s\S]*ON DELETE CASCADE/,
    )
  })
})
