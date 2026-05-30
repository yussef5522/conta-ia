# TODO — Registrar Inter no PDF (refinement Sprint Export)

**Sprint origem:** Export CSV + PDF (29/05/2026)
**Decisão registrada:** começamos com Helvetica default do react-pdf pra
destravar a entrega. Inter fica como refinement de tipografia depois que
todos os 8 relatórios estiverem exportando e validados.

## O que falta

Quando o user decidir aplicar Inter (consistência com brand CAIXAOS):

1. Baixar TTFs Inter (3 weights):
   - `Inter-Regular.ttf` (400)
   - `Inter-Medium.ttf` (500)
   - `Inter-Bold.ttf` (700)
   Fonte oficial: https://fonts.google.com/specimen/Inter

2. Salvar em `public/fonts/`:
   ```
   public/fonts/Inter-Regular.ttf
   public/fonts/Inter-Medium.ttf
   public/fonts/Inter-Bold.ttf
   ```

3. Registrar no `lib/export/pdf/styles.ts` (criar `Font.register` antes
   do `StyleSheet.create`):
   ```typescript
   import { Font } from '@react-pdf/renderer'
   import path from 'path'
   import fs from 'fs'

   // No server-side: caminho absoluto dos TTFs em disco
   const fontsDir = path.join(process.cwd(), 'public', 'fonts')
   Font.register({
     family: 'Inter',
     fonts: [
       { src: path.join(fontsDir, 'Inter-Regular.ttf') },
       { src: path.join(fontsDir, 'Inter-Medium.ttf'), fontWeight: 500 },
       { src: path.join(fontsDir, 'Inter-Bold.ttf'), fontWeight: 700 },
     ],
   })
   ```

4. Trocar `fontFamily: 'Helvetica'` → `fontFamily: 'Inter'` em todos
   os styles compartilhados.

5. Testar em dev + prod: o `Font.register` precisa rodar 1× antes do
   `renderToBuffer`. Cache de fonte do react-pdf evita re-load.

## Por que não foi feito nesta sprint

- Helvetica embutida = zero asset extra, build instantâneo.
- Layout/dados precisam ser validados ANTES de polir tipografia
  (Yussef pode pedir mudança de estrutura, e refinar fonte numa
  versão que vai mudar é desperdício).
- Inter adiciona ~600KB em `public/fonts/` (3 TTFs).

## Cenário de teste pós-Inter

- Gerar Comparativo PDF com Inter → comparar visualmente com Helvetica.
- Verificar peso 500 no header da empresa (vs 400 no corpo).
- Confirmar que letter-spacing do logo SVG inline bate com a fonte
  registrada.
