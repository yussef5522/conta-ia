// ⭐ O AVISO DO MODO DA CONFERÊNCIA DE NOTA — diz a VERDADE sobre o botão (27/11/2026).
//
// ⛔ O CASO (auditoria 26/11): toda nota real mostrava "o CONFIRMAR liga em breve. Nada é gravado
// ainda" — e o Confirmar GRAVA (POST /recebimentos/:nfeId/confirmar). Rótulo que promete o contrário
// do que o botão faz é a pior mentira da tela. Só o modo teste (a prévia de XML) não grava.
import { Eye, FlaskConical } from 'lucide-react'

export function AvisoDoModo({ modoTeste }: { modoTeste: boolean }) {
  return (
    <div data-testid="aviso-do-modo" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${modoTeste ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
      {modoTeste
        ? <><FlaskConical className="h-4 w-4 shrink-0" /> Modo teste — nada é gravado. Experimente à vontade.</>
        : <><Eye className="h-4 w-4 shrink-0" /> Nota real — Confirmar grava a entrada no estoque.</>}
    </div>
  )
}
