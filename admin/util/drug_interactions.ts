/**
 * Analisa uma seção achatada de um rótulo da FDA (interações medicamentosas,
 * dosagem, advertências, contraindicações, indicações etc.) e a divide em blocos
 * ordenados para facilitar a leitura. A divisão é puramente estrutural: todas as
 * palavras do texto original são preservadas na ordem — apenas os marcadores de
 * subseções numeradas e de listas são movidos para os metadados dos blocos. Nenhum
 * texto da FDA é alterado, resumido ou removido. Os testes unitários garantem
 * o cumprimento dessa regra de fidelidade ao conteúdo.
 */

/** Um bloco de texto do rótulo da FDA que pode ser renderizado. */
export interface LabelBlock {
  /** Identificador da subseção, como "7.1", ou null para o texto introdutório/cabeçalho. */
  label: string | null
  /** Texto literal (com o identificador da subseção removido do início), ou null para um bloco de lista. */
  text: string | null
  /** Itens literais da lista, ou null para um bloco de texto. */
  bullets: string[] | null
}

/** Alias para manter a compatibilidade com versões anteriores — nome original da visualização de comparação de interações. */
export type InteractionBlock = LabelBlock

// Cabeçalho inicial da própria seção: um número seguido de um nome de seção em
// LETRAS MAIÚSCULAS, por exemplo, "7 DRUG INTERACTIONS" ou
// "2 DOSAGE AND ADMINISTRATION". Restringir a detecção de subseções ao número
// DESTA seção impede que referências cruzadas no texto, como "(12.3)" ou
// "( 7.1 )", sejam confundidas com títulos de subseções.
const HEADER_RE = /^\s*(\d{1,2})\s+[A-Z][A-Z][A-Z &,/()'.’-]*/

// Número da subseção "<principal>.<n> <Maiúscula><minúscula>",
// usado quando não há cabeçalho.
const SUBSECTION_RE = /\b(\d{1,2})\.\d{1,2}\s+[A-Z][a-z]/g

/** Número principal desta seção — obtido do cabeçalho inicial ou, na ausência dele, do número principal de subseção mais frequente. */
function detectMajor(text: string): string | null {
  const header = text.match(HEADER_RE)
  if (header) return header[1]
  const counts = new Map<string, number>()
  for (const m of text.matchAll(SUBSECTION_RE)) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [major, n] of counts) {
    if (n > bestN) {
      best = major
      bestN = n
    }
  }
  return best
}

export function parseLabelSection(raw: string | null | undefined): LabelBlock[] {
  if (!raw) return []
  const text = raw.trim()
  if (!text) return []

  const major = detectMajor(text)

  let pieces: string[]
  let labelRe: RegExp | null = null
  if (major) {
    // Divide o texto antes de "<principal>.<n> <Maiúscula><minúscula>".
    // O \b impede correspondências dentro de números maiores (por exemplo,
    // "17.1"); o requisito [A-Z][a-z] exclui referências entre parênteses,
    // como "( 7.1 )", pois elas são seguidas por ")". Usa apenas lookahead,
    // sem lookbehind, para oferecer maior compatibilidade com navegadores.
    const splitRe = new RegExp(`(?=\\b${major}\\.\\d{1,2}\\s+[A-Z][a-z])`)
    pieces = text.split(splitRe)
    labelRe = new RegExp(`^(${major}\\.\\d{1,2})\\s+`)
  } else {
    pieces = [text]
  }

  const blocks: LabelBlock[] = []
  for (const rawPiece of pieces) {
    const piece = rawPiece.trim()
    if (!piece) continue

    let label: string | null = null
    let body = piece
    if (labelRe) {
      const m = piece.match(labelRe)
      if (m) {
        label = m[1]
        body = piece.slice(m[0].length).trim()
      }
    }

    if (body.includes('•')) {
      const parts = body.split('•')
      const lead = parts[0].trim()
      const items = parts
        .slice(1)
        .map((s) => s.trim())
        .filter(Boolean)
      if (lead) {
        blocks.push({ label, text: lead, bullets: null })
        if (items.length) blocks.push({ label: null, text: null, bullets: items })
      } else if (items.length) {
        blocks.push({ label, text: null, bullets: items })
      }
    } else if (body) {
      blocks.push({ label, text: body, bullets: null })
    }
  }

  return blocks
}

/** Alias para manter a compatibilidade com versões anteriores da visualização de comparação de interações. */
export const parseInteractions = parseLabelSection

/** Retorna true quando um bloco de texto contém apenas um cabeçalho de seção da FDA no formato "N NOME DA SEÇÃO". */
export function isLabelSectionHeader(text: string | null): boolean {
  return !!text && /^\s*\d{1,2}\s+[A-Z][A-Z][A-Z &,/()'.’-]*$/.test(text)
}

/** Alias para manter a compatibilidade com versões anteriores. */
export const isSectionHeader = isLabelSectionHeader
