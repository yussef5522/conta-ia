/**
 * ⛔⛔⛔ FUNÇÃO COM PARÂMETRO PENDURADA POR REFERÊNCIA — a classe, fechada por TIPO (18/10/2026).
 *
 * **O caso que pariu isto:** o Sprint 2.1 deu um parâmetro ao `abrirPreview`
 * (`confirmouDia?: string`) e o botão da revisão continuou passando a função **por
 * referência** (`acao: abrirPreview`). React chamou `abrirPreview(syntheticEvent)`, o
 * `JSON.stringify` estourou **`Converting circular structure to JSON` antes do fetch**, e o
 * catch traduziu como *"Falha de conexão ao processar."* — o import de 16 e 17/10 ficou
 * parado 2 dias com o nginx não registrando UMA requisição.
 *
 * ⚠️⚠️ **E O `tsc` FICOU VERDE, porque o buraco é de VARIÂNCIA, não de descuido:** TypeScript
 * considera `(dia?: string) => void` **assinável** a `() => void` (função pode ignorar
 * argumentos que ninguém manda — a regra que faz `[1,2].map(x => x)` compilar). Ou seja:
 * ***`() => void` numa prop é um convite aberto a pendurar função que espera dado.***
 *
 * ⭐⭐ **A CURA É O PARÂMETRO `void`.** Declarando o contrato como `(nada: void) => void`, a
 * checagem passa a ser **contravariante com um tipo que nada satisfaz**: `void` não é
 * assinável a `string | undefined`, então `tsc` RECUSA a função que declara parâmetro — e
 * continua aceitando a de zero argumentos, e continua **chamável sem argumento**. É a
 * REGRA 5: o erro deixou de ser improvável e passou a ser **impossível**.
 *
 * ⚠️ A mensagem do compilador cita o nome do parâmetro, e é por isso que ele se chama
 * `naoRecebeNada` — *"Types of parameters 'dia' and 'naoRecebeNada' are incompatible"* é a
 * pista que manda quem errou direto pra cá.
 *
 * ⛔ **O irmão desta classe o `tsc` JÁ cobrava, e isso foi MEDIDO:** handler de evento do DOM
 * (`onClick`) tem contrato `(e: MouseEvent) => void`, e aí `MouseEvent → boolean` não passa na
 * contravariância. O buraco existia **só no contrato zero-arg**. Varredura do app inteiro no
 * dia da cura: **37 props zero-arg recebendo função por referência e 1 única com parâmetro** —
 * o defeito. Por isso o guard irmão (`__tests__/regras-ui/handler-por-referencia.test.ts`)
 * nasce limpo em vez de nascer ruidoso.
 */
export type AcaoSemArgumento = (naoRecebeNada: void) => void
