'use client'

/**
 * 📥 IMPORTAR VENDAS — A CENTRAL. Cópia 1:1 de `docs/importar-referencia.html` (08/10/2026).
 *
 * ⛔⛔ A REFERÊNCIA É A LEI: tokens 1:1 por PAPEL (zero hex), medidas literais do arquivo
 * (`18px 14px`, `11px 16px`, `12.5px`…), seções na ordem dela, frases dela. Divergência do
 * arquivo = defeito, e o guard `importar-bate-com-a-referencia` abre o HTML e cobra.
 *
 * ⚠️ TELA DE LEITURA: nada aqui grava. A única escrita do fluxo é o IMPORT em si (que já
 * existia) e o Σ do arquivo que ele passa a guardar — os dois moram nos componentes de upload,
 * não nesta leitura.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { casaBusca } from '@/lib/busca-texto'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { baixarCsv } from '@/lib/format/csv-cliente'
import type { CentralDeImport, DiaDaCentral } from '@/lib/stock/vendas/central-de-import'
import type { DetalheDoDia } from '@/lib/stock/vendas/detalhe-do-dia'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR')
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const hhmm = (iso: string | null) => {
  if (!iso) return null
  // ⚠️ a hora é exibida no fuso do BRASIL — "23h41" no relógio do servidor em UTC seria 20h41
  const d = new Date(new Date(iso).getTime() - 3 * 3_600_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}h${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}${mes.slice(0, 4) !== String(new Date().getUTCFullYear()) ? ` ${mes.slice(0, 4)}` : ''}`
const mesVizinho = (mes: string, passo: number) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return d.toISOString().slice(0, 7)
}

/** ⚠️ o tom do selo é do SELO, num lugar só — 4 selos, 4 pares de token */
const TOM_DO_SELO: Record<DiaDaCentral['selo'], { bg: string; ink: string; borda?: string }> = {
  COMPLETO: { bg: 'var(--fam-verde-bg)', ink: 'var(--fam-verde-ink)' },
  COMPLEMENTOS_INCOMPLETOS: { bg: 'var(--fam-ambar-bg)', ink: 'var(--fam-ambar-ink)' },
  SABORES_NAO_IMPORTADOS: { bg: 'var(--fam-coral-bg)', ink: 'var(--fam-coral-ink)' },
  SEM_IMPORTACAO: { bg: 'var(--prod-surface)', ink: 'var(--fam-coral-ink)', borda: 'var(--fam-coral-mid)' },
}

/** `.card` da referência: raio 16, borda forte, sombra, margem de 14 embaixo */
function Cartao({ children, rotulo }: { children: React.ReactNode; rotulo?: string }) {
  return (
    <section
      aria-label={rotulo}
      className="mb-[14px] overflow-hidden rounded-[16px] border"
      style={{ background: 'var(--prod-surface)', borderColor: 'var(--prod-line-strong)', boxShadow: 'var(--prod-sombra)' }}
    >
      {children}
    </section>
  )
}

function Selo({ dia }: { dia: DiaDaCentral }) {
  const t = TOM_DO_SELO[dia.selo]
  return (
    <span
      className="whitespace-nowrap rounded-full px-[9px] py-[2px] text-[11px] font-bold"
      style={{ background: t.bg, color: t.ink, border: t.borda ? `1px solid ${t.borda}` : undefined }}
    >
      {dia.seloRotulo}
    </span>
  )
}

export function CentralDeImportView({
  empresaId,
  onImportar,
  onMapearProduto,
  onCriarFichaDeSabor,
  onSubstituirDia,
  onReprocessarDia,
}: {
  empresaId: string
  /** abre o fluxo de upload que JÁ EXISTE, no relatório e no dia pedidos */
  onImportar: (relatorio: 'PRODUTOS' | 'COMPLEMENTOS', dia: string | null) => void
  onMapearProduto: (nome: string) => void
  onCriarFichaDeSabor: (nome: string) => void
  onSubstituirDia: (dia: string) => void
  /**
   * ⚠️⚠️ DIVERGÊNCIA DECLARADA DA REFERÊNCIA, e ela é REALOCAÇÃO, não invenção: o arquivo do
   * dono não tem este gesto, mas a aba "Processados" — que esta central substitui — tinha o
   * **reprocessar** (estorna as baixas do dia e refaz com o mapa de hoje). ***Remoção sem
   * realocação é perda*** (10/09), então ele mudou de casa em vez de morrer.
   *
   * ⛔ E ele NÃO é o "substituir o dia": aquele RE-IMPORTA o arquivo (linhas novas); este
   * refaz a BAIXA a partir das linhas já gravadas. São duas perguntas, e colapsá-las faria o
   * dono achar que reprocessar precisa do .xls na mão.
   */
  onReprocessarDia: (dia: string) => void
}) {
  /**
   * ⛔⛔ O MÊS CORRENTE DO BRASIL TEM **UM DONO**, E ELE É A ROTA.
   *
   * A tela nasce SEM mês e **não manda `?mes=`** na 1ª carga: quem decide é o servidor (`Date.now() - 3h`
   * — às 23h de São Paulo o UTC já diz o dia seguinte, e no dia 1º diria o mês seguinte).
   * Calcular "o mês de hoje" aqui também seria a **segunda régua** da mesma pergunta, e as duas
   * divergiriam exatamente na virada do mês, que é quando o dono mais confere.
   *
   * ⭐ Depois da 1ª resposta o estado passa a carregar o mês que o servidor devolveu, e o ‹ ›
   * navega a partir dele.
   */
  const [mes, setMes] = useState('')
  const [central, setCentral] = useState<CentralDeImport | null>(null)
  const [estado, setEstado] = useState<'CARREGANDO' | 'FALHOU' | 'OK'>('CARREGANDO')
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheDoDia | null>(null)
  const [detEstado, setDetEstado] = useState<'VAZIO' | 'CARREGANDO' | 'FALHOU' | 'OK'>('VAZIO')
  const [abaDet, setAbaDet] = useState<'prod' | 'sab'>('prod')
  const [busca, setBusca] = useState('')
  const [verTudo, setVerTudo] = useState(false)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<CentralDeImport>(
      `/api/empresas/${empresaId}/estoque/vendas/central${mes ? `?mes=${mes}` : ''}`,
    )
    if (!r.ok || !r.data) {
      setErro(r.erro ?? 'Não consegui carregar a central.')
      setEstado('FALHOU')
      return
    }
    setCentral(r.data)
    // ⭐ o mês passa a vir do SERVIDOR — é o que faz o ‹ › navegar a partir do mês certo
    setMes(r.data.mes)
    setEstado('OK')
  }, [empresaId, mes])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirDetalhe = useCallback(
    async (dia: string) => {
      setDetEstado('CARREGANDO')
      setBusca('')
      setVerTudo(false)
      setAbaDet('prod')
      const r = await fetchComTimeout<DetalheDoDia>(`/api/empresas/${empresaId}/estoque/vendas/central/${dia}`)
      if (!r.ok || !r.data) {
        setErro(r.erro ?? 'Não consegui carregar o detalhe do dia.')
        setDetEstado('FALHOU')
        return
      }
      setDetalhe(r.data)
      setDetEstado('OK')
    },
    [empresaId],
  )

  /** ⭐ CAMADA 1: o par do dia mais recente — o alvo que faltou acende âmbar NA HORA */
  const par = central?.parDoUltimoDia ?? null
  const prodOk = par?.temProdutos ?? false
  const compOk = par?.temComplementos ?? false
  const arqProd = useMemo(
    () => central?.dias.find((d) => d.dia === par?.dia)?.detalheArquivos.find((a) => a.relatorio === 'PRODUTOS') ?? null,
    [central, par],
  )
  const arqComp = useMemo(
    () => central?.dias.find((d) => d.dia === par?.dia)?.detalheArquivos.find((a) => a.relatorio === 'COMPLEMENTOS') ?? null,
    [central, par],
  )
  const diaDoPar = central?.dias.find((d) => d.dia === par?.dia) ?? null

  const prodFiltrados = useMemo(
    () => (detalhe?.produtos ?? []).filter((p) => casaBusca(`${p.nome} ${p.destinoRotulo}`, busca)),
    [detalhe, busca],
  )
  const sabFiltrados = useMemo(
    () => (detalhe?.sabores ?? []).filter((s) => casaBusca(`${s.nome} ${s.rotulo}`, busca)),
    [detalhe, busca],
  )
  const LIMITE = 8
  const prodVisiveis = verTudo || busca ? prodFiltrados : prodFiltrados.slice(0, LIMITE)
  const sabVisiveis = verTudo || busca ? sabFiltrados : sabFiltrados.slice(0, LIMITE)

  if (estado === 'CARREGANDO') {
    return <p className="py-[22px] text-[13px]" style={{ color: 'var(--prod-muted)' }}>Lendo a central…</p>
  }
  if (estado === 'FALHOU' || !central) {
    return (
      <div className="py-[22px]">
        <p className="text-[13px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro || 'Não consegui carregar a central.'}</p>
        <button
          onClick={() => void carregar()}
          className="mt-[8px] rounded-[10px] border px-[12px] py-[5px] text-[12.5px]"
          style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }}
        >
          tentar de novo
        </button>
      </div>
    )
  }

  return (
    /* LEI DE LAYOUT (a mesma da margem): largura útil, teto 1440, NUNCA coluna estreita */
    <div className="mx-auto max-w-[1440px] px-[28px] pb-[64px] pt-[22px] max-[700px]:px-[14px] max-[700px]:pb-[56px] max-[700px]:pt-[16px]">
      {/* ===================== CABEÇALHO ===================== */}
      <div className="mb-[14px] flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h1 className="m-0 text-[20px] font-semibold" style={{ color: 'var(--prod-primary)' }}>Importar vendas</h1>
          <p className="mt-[2px] text-[13px]" style={{ color: 'var(--prod-secondary)' }}>do Suitable — e a memória do que já entrou</p>
        </div>
        <div className="flex items-center gap-[6px]">
          <button
            onClick={() => setMes(mesVizinho(mes, -1))}
            className="rounded-full border px-[12px] py-[5px] text-[12.5px] tabular-nums"
            style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)', background: 'var(--prod-surface)' }}
            aria-label="mês anterior"
          >
            ‹
          </button>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>{nomeDoMes(mes)}</span>
          <button
            onClick={() => setMes(mesVizinho(mes, 1))}
            className="rounded-full border px-[12px] py-[5px] text-[12.5px] tabular-nums"
            style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)', background: 'var(--prod-surface)' }}
            aria-label="mês seguinte"
          >
            ›
          </button>
        </div>
      </div>

      {/* ===================== 1 · DROPZONE DUPLA ===================== */}
      {/* ⭐ CAMADA 1 DO AVISO: o alvo que faltou acende âmbar NA HORA, pelo PAR do dia mais
          recente. ⚠️ A referência dizia "par por data detectada no arquivo" — e o retrato
          mostrou que **o relatório do Suitable não traz data nenhuma** (quem informa é o
          dono, desde 02/09). Então o par é pela data INFORMADA, lida do banco; detectar do
          arquivo seria inventar um campo que ele não tem. */}
      <div className="mb-[12px] grid grid-cols-2 gap-[12px] max-[700px]:grid-cols-1">
        <AlvoDeUpload
          titulo="📄 Relatório de Produtos"
          ok={prodOk}
          detalhe={
            prodOk
              ? arqProd
                ? `${arqProd.nomeArquivo} · ${ddmm(par!.dia)} · ${num(arqProd.linhasArquivo)} linhas`
                : `${ddmm(par!.dia)} · ${num(diaDoPar?.conferencia.linhasProdutos ?? 0)} linhas · arquivo não registrado (import anterior a 08/10)`
              : par
                ? `falta o de PRODUTOS de ${ddmm(par.dia)} — sem ele o dia fica cego pro estoque e pra "Quem paga a casa"`
                : 'soltar o arquivo do Suitable (.xls)'
          }
          onClick={() => onImportar('PRODUTOS', par?.dia ?? null)}
        />
        <AlvoDeUpload
          titulo="🍕 Relatório de Complementos"
          ok={compOk}
          detalhe={
            compOk
              ? arqComp
                ? `${arqComp.nomeArquivo} · ${ddmm(par!.dia)} · ${num(arqComp.linhasArquivo)} linhas`
                : `${ddmm(par!.dia)} · ${num(diaDoPar?.conferencia.ocorrenciasSabores ?? 0)} ocorrências · arquivo não registrado (import anterior a 08/10)`
              : par
                ? `falta o de SABORES de ${ddmm(par.dia)} — sem ele, as pizzas vendem sem baixar sabor do estoque`
                : 'soltar o arquivo do Suitable (.xls)'
          }
          onClick={() => onImportar('COMPLEMENTOS', par?.dia ?? null)}
        />
      </div>

      {/* ===================== 2 · ALERTA DO BURACO ===================== */}
      {central.buracos.map((b) => (
        <div
          key={b}
          role="button"
          onClick={() => onImportar('PRODUTOS', b)}
          className="mb-[12px] flex items-center gap-[10px] rounded-[12px] px-[15px] py-[12px]"
          style={{ background: 'var(--fam-coral-bg)' }}
        >
          <span className="text-[18px]">📅</span>
          <p className="m-0 flex-1 text-[13px]" style={{ color: 'var(--fam-coral-ink)' }}>
            <b>{ddmm(b)} ficou sem importação</b> — dia de venda sem arquivo: estoque e &quot;Quem paga a casa&quot; estão cegos pra esse dia.
          </p>
          <span className="whitespace-nowrap text-[12.5px] font-bold" style={{ color: 'var(--fam-coral-ink)' }}>importar este dia →</span>
        </div>
      ))}

      {/* ===================== 3 · DIAS IMPORTADOS ===================== */}
      <Cartao rotulo="Dias importados">
        <div className="flex flex-wrap items-center justify-between gap-[10px] px-[16px] pb-[8px] pt-[13px]">
          <h2 className="m-0 text-[15.5px] font-semibold" style={{ color: 'var(--prod-primary)' }}>Dias importados</h2>
          <span className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
            toque no dia pra abrir a conferência · os selos contam a saúde de cada dia
          </span>
        </div>

        {central.dias.length === 0 && (
          <p className="px-[16px] pb-[14px] text-[13px]" style={{ color: 'var(--prod-muted)' }}>
            nenhum dia de venda em {nomeDoMes(mes)} — navegue nos meses ou importe um arquivo
          </p>
        )}

        {central.dias.map((d) => (
          <div key={d.dia} id={`dia-${d.dia}`} className="scroll-mt-24 border-t" style={{ borderColor: 'var(--prod-line)' }}>
            <div
              role="button"
              aria-expanded={aberto === d.dia}
              onClick={() => (d.buraco ? onImportar('PRODUTOS', d.dia) : setAberto(aberto === d.dia ? null : d.dia))}
              className="flex items-center gap-[10px] px-[16px] py-[11px] text-[13.5px] hover:bg-[var(--prod-surface-1)]"
              style={d.buraco ? { background: 'var(--fam-coral-bg)' } : undefined}
            >
              <span
                className="w-[52px] flex-none font-bold tabular-nums"
                style={{ color: d.buraco ? 'var(--fam-coral-ink)' : 'var(--prod-primary)' }}
              >
                {ddmm(d.dia)}
              </span>
              <Selo dia={d} />
              <span
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums"
                style={{ color: d.buraco ? 'var(--fam-coral-ink)' : 'var(--prod-secondary)' }}
              >
                {d.buraco
                  ? d.frase
                  : `${num(d.unidades)} un · ${brl(d.valor)} · ${d.arquivos} arquivo${d.arquivos === 1 ? '' : 's'} · ${d.frase}`}
              </span>
              {d.buraco ? (
                <span className="whitespace-nowrap text-[12px] font-bold" style={{ color: 'var(--fam-coral-ink)' }}>importar este dia →</span>
              ) : (
                <>
                  <span className="whitespace-nowrap text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {d.quem ?? 'sem autor'}
                    {d.hora ? ` · ${hhmm(d.hora)}` : ''}
                    {d.autorAproximado ? ' (1º import)' : ''}
                  </span>
                  <span style={{ color: 'var(--prod-muted)' }}>{aberto === d.dia ? '▴' : '▾'}</span>
                </>
              )}
            </div>

            {aberto === d.dia && !d.buraco && (
              <div className="px-[16px] pb-[12px] pt-[2px] text-[12.5px]" style={{ background: 'var(--prod-surface-1)' }}>
                {/* ⚠️ Σ do arquivo × Σ gravado — e quando não HÁ Σ do arquivo (dias anteriores
                    a 08/10) a linha diz "Σ gravado" e para aí. ⛔ Inventar um veredito sobre
                    um lado que não existe é o invariante circular de 28/08. */}
                <div className="flex flex-wrap justify-between gap-[10px] py-[3px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
                  {d.conferencia.somaArquivo == null ? (
                    <>
                      <span>Σ gravado</span>
                      <span>{brl(d.conferencia.somaGravada)} · o arquivo deste dia entrou antes de 08/10, então não há Σ declarado pra comparar</span>
                    </>
                  ) : (
                    <>
                      <span>Σ do arquivo × Σ gravado</span>
                      <span
                        className="font-semibold"
                        style={{ color: d.conferencia.bate ? 'var(--fam-verde-ink)' : 'var(--fam-coral-ink)' }}
                      >
                        {brl(d.conferencia.somaArquivo)} {d.conferencia.bate ? '=' : '≠'} {brl(d.conferencia.somaGravada)}{' '}
                        {d.conferencia.bate ? '✓ bate ao centavo' : `⛔ diferença de ${brl(d.conferencia.diferenca ?? 0)}`}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap justify-between gap-[10px] py-[3px] tabular-nums" style={{ color: 'var(--prod-secondary)' }}>
                  <span>produtos {num(d.conferencia.linhasProdutos)} linhas · complementos {num(d.conferencia.ocorrenciasSabores)} ocorrências</span>
                  <span>{d.frase}</span>
                </div>
                {d.conferencia.semDestino > 0 && (
                  <div className="flex flex-wrap justify-between gap-[10px] py-[3px]">
                    <span className="font-semibold" style={{ color: 'var(--fam-ambar-ink)' }}>
                      ⚠ {d.conferencia.semDestino} produtos sem destino — venderam e não baixaram estoque
                    </span>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); void abrirDetalhe(d.dia) }}
                      className="font-semibold"
                      style={{ color: 'var(--fam-indigo-mid)' }}
                    >
                      mapear →
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-[14px] pt-[7px]">
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); void abrirDetalhe(d.dia) }}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--fam-indigo-mid)' }}
                  >
                    ver as {num(d.conferencia.linhasProdutos)} linhas →
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onSubstituirDia(d.dia) }}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--fam-indigo-mid)' }}
                  >
                    substituir o dia (re-importar com preview) →
                  </span>
                  {/* ⚠️ a 4ª ação é a que mudou de casa com a morte da aba "Processados" */}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onReprocessarDia(d.dia) }}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--fam-indigo-mid)' }}
                  >
                    refazer a baixa com o mapa de hoje →
                  </span>
                  {/* ⚠️ CSV pelo helper da casa (`baixarCsv`), nunca uma rota nova só pra
                      isso: o arquivo sai do MESMO payload que a tela desenha, então não há
                      como o CSV e a tela discordarem. */}
                  <span
                    role="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      const r = await fetchComTimeout<DetalheDoDia>(
                        `/api/empresas/${empresaId}/estoque/vendas/central/${d.dia}`,
                      )
                      if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui montar o CSV.'); return }
                      baixarCsv(
                        `import-${d.dia}`,
                        ['Produto', 'Unidades', 'Valor', 'Destino no estoque'],
                        r.data.produtos.map((p) => [p.nome, p.unidades, p.valor, p.destinoRotulo]),
                      )
                    }}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--fam-indigo-mid)' }}
                  >
                    CSV ↓
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </Cartao>

      <p className="m-0 mt-[4px] px-[2px] text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
        🔔 camada 3: dia que amanhece torto (sem importação · sem sabores · incompleto) = aviso no sininho às 10h,
        setor estoque, língua do balcão, anti-spam padrão — uma causa, um alarme.
      </p>

      {/* ===================== 4 · DETALHE DO DIA ===================== */}
      {detEstado !== 'VAZIO' && (
        <div id="detalhe" className="mt-[14px] scroll-mt-24">
          <Cartao rotulo="Detalhe da importação">
            {detEstado === 'CARREGANDO' && (
              <p className="px-[16px] py-[14px] text-[13px]" style={{ color: 'var(--prod-muted)' }}>Lendo as linhas do dia…</p>
            )}
            {detEstado === 'FALHOU' && (
              <p className="px-[16px] py-[14px] text-[13px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>
            )}
            {detEstado === 'OK' && detalhe && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-[10px] px-[16px] pb-[8px] pt-[13px]">
                  <div>
                    <p className="m-0 text-[15.5px] font-semibold" style={{ color: 'var(--prod-primary)' }}>
                      Importação de {ddmm(detalhe.dia)}
                    </p>
                    <p className="mt-[2px] text-[12px]" style={{ color: 'var(--prod-secondary)' }}>
                      {num(detalhe.totais.linhas)} linhas de produto · {num(detalhe.totais.ocorrencias)} ocorrências de sabor
                    </p>
                  </div>
                  <label
                    className="flex items-center gap-[6px] rounded-full border px-[12px] py-[5px] text-[12.5px]"
                    style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)', background: 'var(--prod-surface)' }}
                  >
                    🔎
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="buscar produto ou sabor…"
                      aria-label="buscar produto ou sabor"
                      className="w-[170px] border-0 bg-transparent font-[inherit] outline-none"
                      style={{ color: 'var(--prod-primary)' }}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-[6px] px-[16px] pb-[10px]">
                  <Chip on={abaDet === 'prod'} onClick={() => setAbaDet('prod')}>
                    Produtos · {num(detalhe.totais.linhas)} linhas
                  </Chip>
                  <Chip on={abaDet === 'sab'} onClick={() => setAbaDet('sab')}>
                    Sabores · {num(detalhe.totais.ocorrencias)} ocorrências
                  </Chip>
                </div>

                {abaDet === 'prod' ? (
                  <>
                    <div
                      className="grid gap-[8px] border-t px-[16px] py-[8px] text-[11px] font-bold tracking-[.03em] [grid-template-columns:minmax(0,2fr)_.6fr_.9fr_1.3fr]"
                      style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-muted)' }}
                    >
                      <span>PRODUTO</span><span className="text-right">UN</span><span className="text-right">VALOR</span>
                      <span className="text-right">DESTINO NO ESTOQUE</span>
                    </div>
                    {prodVisiveis.map((p, i) => (
                      <div
                        key={p.nome}
                        className="grid items-center gap-[8px] border-t px-[16px] py-[9px] text-[13px] tabular-nums [grid-template-columns:minmax(0,2fr)_.6fr_.9fr_1.3fr]"
                        style={{
                          borderColor: 'var(--prod-line)',
                          background:
                            p.destino === 'SEM_DESTINO'
                              ? 'var(--fam-ambar-bg)'
                              : i % 2 === 1
                                ? 'var(--prod-surface-1)'
                                : undefined,
                        }}
                      >
                        <span
                          className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                          style={{ color: p.destino === 'SEM_DESTINO' ? 'var(--fam-ambar-ink)' : 'var(--prod-primary)' }}
                        >
                          {p.destino === 'SEM_DESTINO' ? '⚠ ' : ''}{p.nome}
                        </span>
                        <span className="text-right" style={{ color: 'var(--prod-secondary)' }}>{num(p.unidades)}</span>
                        <span className="text-right" style={{ color: 'var(--prod-primary)' }}>{brl(p.valor)}</span>
                        {p.destino === 'SEM_DESTINO' ? (
                          <span className="text-right text-[12px] font-semibold" style={{ color: 'var(--fam-ambar-ink)' }}>
                            sem destino —{' '}
                            <span role="button" onClick={() => onMapearProduto(p.nome)} style={{ color: 'var(--fam-indigo-mid)' }}>
                              mapear →
                            </span>
                          </span>
                        ) : (
                          <span className="text-right text-[12px]" style={{ color: 'var(--fam-verde-ink)' }}>{p.destinoRotulo}</span>
                        )}
                      </div>
                    ))}
                    {!verTudo && !busca && prodFiltrados.length > LIMITE && (
                      <div
                        role="button"
                        onClick={() => setVerTudo(true)}
                        className="border-t px-[16px] py-[7px] text-center text-[12px]"
                        style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-muted)' }}
                      >
                        … mais {num(prodFiltrados.length - LIMITE)} linhas (ordenadas por valor · a busca filtra tudo)
                      </div>
                    )}
                    {busca && prodFiltrados.length === 0 && (
                      <p className="px-[16px] py-[9px] text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                        nenhum dos {num(detalhe.produtos.length)} produtos do dia casa com «{busca}»
                      </p>
                    )}
                    <div
                      className="flex flex-wrap justify-between gap-[10px] border-t px-[16px] py-[10px] text-[12.5px] tabular-nums"
                      style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface-1)' }}
                    >
                      <span style={{ color: 'var(--prod-secondary)' }}>
                        Σ das linhas <b style={{ color: 'var(--prod-primary)' }}>{num(detalhe.totais.unidades)} un · {brl(detalhe.totais.valor)}</b>
                      </span>
                      <span className="font-bold" style={{ color: detalhe.totais.bateComODia ? 'var(--fam-verde-ink)' : 'var(--fam-coral-ink)' }}>
                        {detalhe.totais.bateComODia ? '= Σ do dia ✓ bate ao centavo' : '⛔ a soma das linhas não fecha com o dia'}
                      </span>
                      <span style={{ color: 'var(--prod-secondary)' }}>{num(detalhe.totais.semDestino)} sem destino</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="grid gap-[8px] border-t px-[16px] py-[8px] text-[11px] font-bold tracking-[.03em] [grid-template-columns:minmax(0,2fr)_.6fr_1.5fr]"
                      style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-muted)' }}
                    >
                      <span>SABOR</span><span className="text-right">VEZES</span><span className="text-right">FICHA</span>
                    </div>
                    {sabVisiveis.map((s, i) => {
                      const pendente = s.ehSabor && !s.temFicha
                      return (
                        <div
                          key={s.nome}
                          className="grid items-center gap-[8px] border-t px-[16px] py-[9px] text-[13px] tabular-nums [grid-template-columns:minmax(0,2fr)_.6fr_1.5fr]"
                          style={{
                            borderColor: 'var(--prod-line)',
                            background: pendente ? 'var(--fam-ambar-bg)' : i % 2 === 1 ? 'var(--prod-surface-1)' : undefined,
                          }}
                        >
                          {/* ⭐ o nome é SEMPRE clicável (regra da casa): com ficha abre, sem
                              ficha cria. ⛔ EXCETO tamanho vazado (`GRANDE`), que não é sabor
                              e não pode oferecer "criar ficha" — criaria uma ficha que baixa
                              estoque errado em toda pizza grande. */}
                          {s.ehSabor ? (
                            <span
                              role="button"
                              onClick={() => (s.temFicha ? onMapearProduto(s.nome) : onCriarFichaDeSabor(s.nome))}
                              className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold underline"
                              style={{ color: pendente ? 'var(--fam-ambar-ink)' : 'var(--fam-indigo-mid)' }}
                            >
                              {pendente ? '⚠ ' : ''}{s.nome}
                            </span>
                          ) : (
                            <span
                              className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                              style={{ color: 'var(--prod-muted)' }}
                            >
                              {s.nome}
                            </span>
                          )}
                          <span className="text-right" style={{ color: 'var(--prod-secondary)' }}>{num(s.vezes)}</span>
                          {pendente ? (
                            <span className="text-right text-[12px] font-semibold" style={{ color: 'var(--fam-ambar-ink)' }}>
                              sem ficha —{' '}
                              <span role="button" onClick={() => onCriarFichaDeSabor(s.nome)} style={{ color: 'var(--fam-indigo-mid)' }}>
                                criar agora →
                              </span>
                            </span>
                          ) : (
                            <span
                              className="text-right text-[12px]"
                              style={{ color: s.ehSabor ? 'var(--fam-verde-ink)' : 'var(--prod-muted)' }}
                            >
                              {s.rotulo}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {!verTudo && !busca && sabFiltrados.length > LIMITE && (
                      <div
                        role="button"
                        onClick={() => setVerTudo(true)}
                        className="border-t px-[16px] py-[7px] text-center text-[12px]"
                        style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-muted)' }}
                      >
                        … todas as ocorrências do dia, por volume · clique no nome: com ficha abre, sem ficha cria
                      </div>
                    )}
                    {busca && sabFiltrados.length === 0 && (
                      <p className="px-[16px] py-[9px] text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                        nenhum dos {num(detalhe.sabores.length)} sabores do dia casa com «{busca}»
                      </p>
                    )}
                    <div
                      className="flex flex-wrap justify-between gap-[10px] border-t px-[16px] py-[10px] text-[12.5px] tabular-nums"
                      style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface-1)' }}
                    >
                      <span style={{ color: 'var(--prod-secondary)' }}>
                        Σ das ocorrências <b style={{ color: 'var(--prod-primary)' }}>{num(detalhe.totais.ocorrencias)}</b> ·{' '}
                        {num(detalhe.totais.saboresSemFicha)} sem ficha
                      </span>
                      <span className="font-bold" style={{ color: 'var(--fam-verde-ink)' }}>= Σ do dia ✓</span>
                    </div>
                  </>
                )}
              </>
            )}
          </Cartao>
        </div>
      )}
    </div>
  )
}

/** `.drop` da referência: tracejado 1.5px, raio 16, padding 18/14, centro */
function AlvoDeUpload({
  titulo, ok, detalhe, onClick,
}: { titulo: string; ok: boolean; detalhe: string; onClick: () => void }) {
  /** ⚠️ 3 estados, e o do meio é o que a referência chama de `.falta`: âmbar, não vermelho —
   *  é trabalho a fazer, não defeito de dado. */
  const estilo = ok
    ? { borderStyle: 'solid' as const, borderColor: 'var(--fam-verde-mid)', background: 'var(--fam-verde-bg)' }
    : { borderStyle: 'dashed' as const, borderColor: 'var(--fam-ambar-mid)', background: 'var(--fam-ambar-bg)' }
  return (
    <div
      role="button"
      onClick={onClick}
      className="rounded-[16px] border-[1.5px] px-[14px] py-[18px] text-center"
      style={estilo}
    >
      <p className="m-0 text-[13.5px] font-semibold" style={{ color: ok ? 'var(--fam-verde-ink)' : 'var(--fam-ambar-ink)' }}>
        {titulo}{ok ? ' — entrou ✓' : ''}
      </p>
      <p
        className="mt-[3px] text-[11.5px] tabular-nums"
        style={{ color: ok ? 'var(--fam-verde-ink)' : 'var(--fam-ambar-ink)', fontWeight: ok ? undefined : 600 }}
      >
        {detalhe}
      </p>
    </div>
  )
}

/** `.chip` / `.chip.on` da referência: pílula 12.5px, 5/12px */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full border px-[12px] py-[5px] text-[12.5px]"
      style={
        on
          ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)', borderColor: 'transparent', fontWeight: 600 }
          : { background: 'var(--prod-surface)', color: 'var(--prod-secondary)', borderColor: 'var(--prod-line-strong)' }
      }
    >
      {children}
    </button>
  )
}
