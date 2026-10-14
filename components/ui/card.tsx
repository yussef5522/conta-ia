import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * ⭐⭐⭐ O CARTÃO DA FUNDAÇÃO — L4 + L6 em 161 arquivos, por CONSTRUÇÃO (14/10/2026).
 *
 * **L4:** *"borda de cartão 1px sólida"* — `border` do Tailwind já É 1px solid, e desde 14/10 a
 * cor dele (`--border`) é a `--linha` da referência. Nada a fazer: já estava certo.
 *
 * ⭐⭐ **L6 é o que mudou, e era uma DIVERGÊNCIA VIVA da lei:** *"sombra curta de 2 camadas nos
 * cartões do tema CLARO; no escuro a elevação é por SUPERFÍCIE, não por sombra"*. O `shadow-sm`
 * do Tailwind é um valor cravado que vale **nos dois temas** — ou seja, todo cartão do tema
 * escuro tinha sombra, contra a lei. Lendo `var(--prod-sombra)`, o claro ganha as 2 camadas da
 * referência e o escuro ganha `none`, **com uma edição em vez de 161**.
 *
 * ⚠️ Vai em `style` e não em classe de propósito: `box-shadow` com `var()` não tem utilitário
 * no Tailwind 3, e `shadow-[var(--x)]` com opacidade é justamente a armadilha de 05/10 (sai
 * transparente). ⛔ E `style` vem ANTES do spread: `<Card style={{…}}>` de quem chama continua
 * vencendo — tirar a sombra num cartão específico segue possível.
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground', className)}
      style={{ boxShadow: 'var(--prod-sombra)' }}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
