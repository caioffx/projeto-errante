/**
 * Referência de Medicamentos — utilitários para listas de IDs de comparação.
 *
 * Módulo puro (sem imports do Lucid / HTTP), para que possa ser testado
 * unitariamente sem inicializar o contêiner do AdonisJS. Segue o padrão de file_classification.ts.
 */

/** Número máximo de medicamentos que podem ser comparados lado a lado. */
export const MAX_COMPARE = 5

/**
 * Analisa uma string bruta de IDs separados por vírgulas, gerando
 * uma lista validada, sem duplicatas e limitada a IDs inteiros positivos.
 *
 * Regras (na ordem):
 *   1. Divide a string pelas vírgulas.
 *   2. Remove os espaços em branco do início e do fim de cada segmento.
 *   3. Converte cada segmento em um número inteiro na base 10.
 *   4. Descarta qualquer resultado que não seja um número inteiro finito maior que 0.
 *   5. Remove duplicatas, preservando a ordem da primeira ocorrência.
 *   6. Limita a lista a MAX_COMPARE elementos; os excedentes são descartados silenciosamente.
 *
 * Retorna [] se a entrada estiver vazia ou contiver apenas valores inválidos.
 *
 * @example
 *   parseCompareIds('1,2,3')         // [1, 2, 3]
 *   parseCompareIds('2,1,2,3,4,5,6') // [2, 1, 3, 4, 5] (sem duplicatas, limitada a 5)
 *   parseCompareIds('0,-1,abc,')     // []
 *   parseCompareIds('  3 , 1 ')      // [3, 1]
 */
export function parseCompareIds(raw: string): number[] {
  if (!raw || raw.trim() === '') return []

  const seen = new Set<number>()
  const result: number[] = []

  for (const segment of raw.split(',')) {
    if (result.length >= MAX_COMPARE) break

    const trimmed = segment.trim()
    if (trimmed === '') continue

    const n = Number(trimmed)

    // Deve ser um número inteiro finito maior que zero.
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) continue

    if (seen.has(n)) continue

    seen.add(n)
    result.push(n)
  }

  return result
}
