/**
 * ⭐⭐⭐ A MESA DA COZINHA (a mesa ②) — SÓ LEITURA, e isso é estrutural (15/10/2026).
 *
 * ⛔⛔⛔ **ZERO ESCRITA: esta rota não tem POST, PATCH nem DELETE.** A mesa é um retrato do dia;
 * um painel que escreve é um painel que muda o dado só por ser aberto — e a ordem do dono foi
 * explícita (*"ZERO escrita em tudo — o dashboard só lê"*). A ausência do handler é a trava.
 *
 * ⛔ **`stock.manage`, nunca `operate`** — e é o MESMO gate do `dia-ao-vivo` e da fila, pelo
 * mesmo motivo: a mesa mostra **o ritmo de cada pessoa lado a lado** e o **veredito do fiscal**.
 * Isso é conversa de gestão (a régua de 06/09) e **cola de prova** na tela de quem declara (a
 * lei de 05/10). ⚠️ Em `stock.view` o payload viajaria até o tablet e a cola estaria a um
 * DevTools de distância.
 *
 * ⭐ E o RELÓGIO entra aqui, uma vez: `new Date()` é desta rota, e a mesa resolve o dia do
 * BRASIL a partir dele. ⛔ Nenhuma lib da mesa olha relógio — senão, na virada do dia, elas
 * discordariam entre si sobre que dia é hoje.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lerMesaDaCozinha } from '@/lib/stock/producao/mesa-da-cozinha'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  /** ⚠️ o dia vem de São Paulo, não de UTC — o bug que fazia a conclusão das 21h sumir */
  const dia = request.nextUrl.searchParams.get('dia') || diaEmSaoPaulo()
  return NextResponse.json(await lerMesaDaCozinha(companyId, dia, new Date(), prisma))
}
