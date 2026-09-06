// ⛔⛔⛔ O CONVITE ABRIA A CONTA DE QUEM JÁ ESTAVA LOGADO (06/09/2026).
//
// **INCIDENTE REAL.** O dono criou um convite pro gerente novo, clicou no link pra conferir e
// **caiu no próprio dashboard, com financeiro e bancos à vista** — três vezes seguidas
// (04/09 21:50:58, 21:51:15, 21:51:51, todas **307** no log do nginx). A leitura dele foi
// *"o convite está entregando a minha sessão"*.
//
// ⚠️ A CAUSA MEDIDA É VIZINHA DISSO, E O MECANISMO É OUTRO: o convite **não** entrega sessão
// nenhuma — a rota de aceite exige login e confere o e-mail. O que acontecia é que
// `/aceitar-convite` estava na lista de páginas públicas, e a regra dali era *"tem sessão? vai
// pro dashboard"*. **O token do convite era DESCARTADO** e quem clicava caía na conta que
// estivesse aberta naquele navegador.
//
// ⭐ A REGRA ERA CERTA NO LUGAR ERRADO: "já logado não precisa ver o login" vale pra `/login`
// e `/cadastro`. O convite é o **oposto** — ele existe pra ser aberto por alguém DIFERENTE de
// quem está logado. E num aparelho COMPARTILHADO (o tablet da cozinha) isso deixa de ser
// inconveniência e vira porta.
//
// ⛔ ESTE TESTE EXECUTA O PROXY DE VERDADE (REGRA 3), com um cookie de sessão assinado — não
// procura string em arquivo.

import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { proxy } from '@/proxy'

const BASE = 'http://localhost:3000'
const TOKEN_DO_CONVITE = '1668d48bfdd531808b5628466c8eca5cfd6b0c67f63afc36c5220a83f5b36cf1'

let sessao = ''

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'segredo-de-teste-com-tamanho-suficiente-pra-hs256'
  sessao = await new SignJWT({ sub: 'user-do-dono', email: 'dono@empresa.com', name: 'Dono' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
})

/** uma requisição de página, com ou sem a sessão do dono no cookie */
function pedir(caminho: string, comSessao: boolean) {
  const req = new NextRequest(new URL(caminho, BASE), { headers: new Headers() })
  if (comSessao) req.cookies.set('auth_token', sessao)
  return proxy(req)
}

const destino = (r: Response) => r.headers.get('location')

describe('⛔⛔ o link do convite nunca é engolido', () => {
  const LINK = `/aceitar-convite?token=${TOKEN_DO_CONVITE}`

  it('⛔⛔ COM a sessão de outra pessoa, o convite ABRE — não vai pro dashboard', async () => {
    const r = await pedir(LINK, true)
    // ⚠️ era exatamente aqui que dava 307 → /dashboard, com o token no lixo
    expect(destino(r), 'o convite caiu no dashboard de quem estava logado').toBeNull()
    expect(r.status).toBe(200)
  })

  it('⭐ SEM sessão nenhuma também abre (quem vem do e-mail está deslogado)', async () => {
    const r = await pedir(LINK, false)
    expect(destino(r)).toBeNull()
    expect(r.status).toBe(200)
  })

  it('⭐ e o TOKEN sobrevive à passagem pelo proxy — é ele que identifica o convite', async () => {
    const r = await pedir(LINK, true)
    // não houve redirect: a URL original (com o token) segue pra página
    expect(destino(r)).toBeNull()
  })
})

describe('⭐ o atalho continua valendo onde ele faz sentido', () => {
  // ⚠️ a correção NÃO podia virar "ninguém mais redireciona": logar e cair na tela de login
  // de novo é o bug oposto, e mais visível.
  it.each(['/login', '/cadastro', '/esqueci-senha'])('%s logado ainda vai pro dashboard', async (p) => {
    expect(destino(await pedir(p, true))).toBe(`${BASE}/dashboard`)
  })

  it('⭐ e deslogado essas mesmas páginas abrem normalmente', async () => {
    for (const p of ['/login', '/cadastro', '/esqueci-senha']) {
      expect(destino(await pedir(p, false)), p).toBeNull()
    }
  })
})

describe('⛔ e o resto do sistema continua fechado', () => {
  it('⛔⛔ página protegida sem sessão vai pro login (o convite não abriu buraco)', async () => {
    expect(destino(await pedir('/dashboard', false))).toBe(`${BASE}/login`)
  })

  it('⛔ API protegida sem sessão devolve 401, não redirect', async () => {
    const r = await pedir('/api/empresas', false)
    expect(r.status).toBe(401)
  })

  it('⛔⛔ a página do convite NÃO dá acesso a mais nada: só ela é pública', async () => {
    // ⚠️ o caminho tem que casar EXATO — `/aceitar-convite/qualquer-coisa` não é público
    expect(destino(await pedir('/aceitar-convite/x', false))).toBe(`${BASE}/login`)
  })
})

describe('⭐ a lista é INVERTIDA de propósito', () => {
  it('⭐⭐ página pública NOVA nasce no comportamento seguro (não redireciona)', async () => {
    // As públicas que NÃO estão na lista de atalho: nenhuma delas pode engolir sessão.
    // Se alguém adicionar uma página pública nova, ela cai aqui — segura por default.
    for (const p of ['/', '/planos', '/termos', '/privacidade', '/aceitar-convite']) {
      expect(destino(await pedir(p, true)), `${p} redirecionou o logado`).toBeNull()
    }
  })
})
