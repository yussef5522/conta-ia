/**
 * ⭐⭐⭐ QUEM VÊ QUE SETOR — PURO (04/10/2026).
 *
 * ⛔⛔ **O SININHO É GLOBAL, E ISSO ABRE UM FLANCO QUE ESTA CASA JÁ PAGOU.** Em 30/08 a
 * operadora convidada como `OPERADOR_ESTOQUE` abriu o Fluxo de Caixa e viu *"entrou:
 * 475.739,55"* — três rotas de financeiro respondendo 200 pra quem só opera estoque. Um sininho
 * que mostrasse *"a fatura do Carter venceu"* pra ela seria **o mesmo vazamento, de novo, por
 * uma porta nova**.
 *
 * ⭐ Então a lei do dono (*"financeiro NUNCA aparece na produção"*) tem uma irmã que ele não
 * precisou escrever porque já é lei da casa: **financeiro nunca aparece pra quem não pode ver
 * financeiro** — em tela nenhuma, nem no sininho.
 *
 * ⚠️ **ALLOWLIST, nunca denylist** (a lição do menu de 30/08, em que a blocklist escondeu os
 * itens que eu LEMBREI e deixou passar Dashboard, Tributário, Usuários e Auditoria): setor novo
 * só é visível quando alguém o mapear aqui. O erro seguro é o aviso não aparecer; o inseguro é
 * dinheiro aparecer pra quem não devia.
 */
import { permissionMatches } from '@/lib/auth/permissions'
import { SETORES, type Setor } from './tipos'

/** a chave que cada setor exige — pelo menos UMA delas */
const CHAVE_DO_SETOR: Record<Setor, string[]> = {
  producao: ['stock.view'],
  estoque: ['stock.view'],
  financeiro: ['transaction.view'],
  /**
   * ⚠️ `sistema` (certificado vencendo, cron parado, o verde semanal) não é de módulo nenhum:
   * quem opera QUALQUER parte da casa precisa saber que o sistema está de pé. Mas não é "todo
   * mundo" — sem nenhuma das duas chaves a pessoa não opera nada aqui.
   */
  sistema: ['stock.view', 'transaction.view'],
}

export function setoresVisiveis(permissions: string[]): Setor[] {
  return SETORES.filter((s) => CHAVE_DO_SETOR[s].some((k) => permissionMatches(permissions, k)))
}

export function podeVerSetor(permissions: string[], setor: Setor): boolean {
  return CHAVE_DO_SETOR[setor].some((k) => permissionMatches(permissions, k))
}
