// CSV gerado NO CLIENTE, a partir do que a tela já carregou (24/08).
//
// Por quê no cliente: as telas do estoque que não têm endpoint de export já têm a lista
// inteira em memória — pedir uma rota nova só pra reformatar o mesmo dado seria rota a
// mais pra manter, testar e travar com permissão. Onde JÁ EXISTE endpoint (posição,
// movimentos, real vs teórico), a tela continua usando o do servidor: lá o CSV pode trazer
// mais linhas do que a tela mostra (limite de 5.000 no extrato), então são coisas
// diferentes e a do servidor é a certa.
//
// Implementação ÚNICA (REGRA 4) — antes cada rota montava seu CSV com `;`, aspas e BOM
// repetidos na mão.

/** Escapa um valor pro dialeto que o Excel-pt-BR abre sem perguntar nada. */
function celula(v: unknown): string {
  if (v == null) return '""'
  if (typeof v === 'number') return `"${String(v).replace('.', ',')}"` // decimal pt-BR
  return `"${String(v).replace(/"/g, '""')}"`
}

export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
  return `﻿${corpo}` // BOM: sem ele o Excel come os acentos
}

/** Dispara o download no browser. Sem lib, sem rota. */
export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: unknown[][]): void {
  const blob = new Blob([montarCsv(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** data pro nome do arquivo: recebimentos-2026-08-24.csv */
export const hojeArquivo = () => new Date().toISOString().slice(0, 10)
