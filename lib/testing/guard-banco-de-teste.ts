// ⛔ TRAVA POR CONSTRUÇÃO — a suíte NUNCA toca banco real (26/08).
//
// O QUE ACONTECEU: em 08/08 às 01:21 alguém rodou `npx vitest` DENTRO do servidor.
// O `.env` de lá aponta pra produção, o `lib/db.ts` lê o ambiente, e os testes criaram
// **30 perfis PF e 18 cartões** no banco de produção. Ficaram invisíveis na tela (não
// têm usuário vinculado), mas sujam contagem, relatório e qualquer auditoria.
//
// ⚠️ POR QUE "NÃO RODAR TESTE NO SERVIDOR" NÃO BASTA (REGRA 5): é um combinado que
// depende de lembrar, às 1h da manhã, com o terminal já aberto no servidor. Disciplina
// vira impossibilidade — aqui o processo RECUSA subir.
//
// ⚠️ POR QUE A REGRA É POR NOME DO BANCO, NÃO POR HOST: o Postgres de produção roda na
// MESMA máquina, então a URL de prod também diz `localhost`. Barrar "host remoto" não
// pegaria nada. O que distingue é o nome: `conta_ia_prod` × `dev.db`.
//
// ⚠️ E É ALLOWLIST, NÃO DENYLIST: bloquear o que "parece produção" falha no dia em que
// o banco se chamar `caixaos` ou `conta_ia`. Aqui só passa o que é COMPROVADAMENTE de
// teste; qualquer coisa desconhecida é recusada.

export class BancoDeProducaoError extends Error {
  readonly code = 'BANCO_NAO_E_DE_TESTE'
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'BancoDeProducaoError'
  }
}

/** Só o necessário pra decidir — nunca a URL inteira (tem senha). */
export interface AlvoDoBanco {
  protocolo: string
  nomeDoBanco: string
}

/** Extrai protocolo + nome do banco SEM carregar credencial junto. */
export function descreverAlvo(databaseUrl: string): AlvoDoBanco {
  const url = (databaseUrl ?? '').trim()
  if (url.startsWith('file:')) {
    return { protocolo: 'file:', nomeDoBanco: url.slice('file:'.length).replace(/^\.?\//, '') }
  }
  try {
    const u = new URL(url)
    return { protocolo: u.protocol, nomeDoBanco: u.pathname.replace(/^\//, '') }
  } catch {
    return { protocolo: '(ilegível)', nomeDoBanco: '' }
  }
}

/** É um banco que a suíte pode destruir à vontade? */
export function ehBancoDeTeste(databaseUrl: string): boolean {
  const { protocolo, nomeDoBanco } = descreverAlvo(databaseUrl)
  // SQLite local é o dev deste projeto — descartável por natureza.
  if (protocolo === 'file:') return true
  // Postgres só passa se o NOME disser que é de teste.
  if (protocolo === 'postgresql:' || protocolo === 'postgres:') {
    return /(^|[_-])test($|[_-])|test$/i.test(nomeDoBanco) || /scratch/i.test(nomeDoBanco)
  }
  return false
}

/**
 * Chamado no setup do vitest. Lança ANTES de qualquer teste abrir conexão.
 * A mensagem diz o que fazer — alerta que não ensina a sair vira ruído.
 */
export function assertBancoDeTeste(databaseUrl: string | undefined): void {
  if (!databaseUrl) return // sem URL, nenhum teste de integração conecta mesmo
  if (ehBancoDeTeste(databaseUrl)) return

  const { protocolo, nomeDoBanco } = descreverAlvo(databaseUrl)
  throw new BancoDeProducaoError(
    [
      '',
      '⛔ SUÍTE BLOQUEADA — o DATABASE_URL não é de um banco de teste.',
      '',
      `   protocolo : ${protocolo}`,
      `   banco     : ${nomeDoBanco || '(não identificado)'}`,
      '',
      '   Os testes CRIAM E APAGAM dados. Em 08/08/2026 uma execução dentro do',
      '   servidor deixou 30 perfis e 18 cartões no banco de PRODUÇÃO.',
      '',
      '   Se você está no servidor: não rode a suíte aqui. Rode na sua máquina.',
      '   Se é um banco de teste novo: inclua "test" no nome dele.',
      '',
    ].join('\n'),
  )
}
