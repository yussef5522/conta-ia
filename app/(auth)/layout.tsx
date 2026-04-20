import { Sparkles } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 p-10 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold">Conta IA</span>
        </div>

        <div className="space-y-4">
          <blockquote className="text-2xl font-semibold leading-snug">
            &ldquo;Seu contador inteligente que nunca dorme.&rdquo;
          </blockquote>
          <p className="text-slate-400 text-sm">
            Gestão financeira automatizada para empresas brasileiras. Conciliação bancária, impostos
            e relatórios — tudo em um só lugar.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {[
            'Pronto para a Reforma Tributária 2026',
            'Open Finance via Pluggy.ai',
            'IA contadora que aprende com seu negócio',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
