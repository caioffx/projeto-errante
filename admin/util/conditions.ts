/**
 * "Quando usar o quê" — funções auxiliares puras e testáveis por unidade (Fase 1 + Fase 2).
 *
 * SEM imports de Lucid / AdonisJS / HTTP. Elas recebem objetos simples e retornam
 * objetos simples, permitindo execução independente com `node --experimental-strip-types`
 * sem inicializar o MySQL ou o Redis. Segue a convenção das funções auxiliares de `drug_labels.ts`.
 */

import type {
  Condition,
  ConditionsFile,
  ConditionSummary,
  NaturalRemedy,
  NaturalRemediesFile,
} from '../types/conditions.js'
import type { DrugSearchResult } from '../types/drug_reference.js'

/**
 * Strings canônicas de product_type da FDA, espelhadas de `PRODUCT_TYPES` em
 * types/drug_reference.ts. Definidas diretamente aqui (não importadas) para que
 * este módulo continue sendo uma função auxiliar pura, sem imports de valores,
 * executável com `node --experimental-strip-types` (que não reescreve especificadores
 * `.js` para `.ts` em imports de valores usados em tempo de execução).
 * O teste independente verifica se estes valores são iguais a PRODUCT_TYPES.OTC / .RX,
 * impedindo que divirjam da fonte canônica.
 */
export const OTC_PRODUCT_TYPE = 'HUMAN OTC DRUG'
export const RX_PRODUCT_TYPE = 'HUMAN PRESCRIPTION DRUG'

// ─── Análise da estrutura principal (falha controlada) ─────────────────────────

/** Remove os espaços das extremidades de um valor e retorna uma string não vazia ou null. */
function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Valida e converte uma entrada bruta de condição para o tipo Condition.
 *
 * Retorna null quando a estrutura da entrada não pode ser usada (falta slug/label/
 * category ou não há searchTerms utilizáveis), permitindo que quem chamou a função
 * ignore a entrada em vez de exibir uma linha com erro. Os searchTerms têm duplicatas
 * removidas (sem diferenciar maiúsculas de minúsculas) e valores vazios são eliminados;
 * entradas sem nenhum termo utilizável são descartadas (pois nunca corresponderiam a nada).
 */
export function parseConditionEntry(raw: unknown): Condition | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const slug = nonEmptyString(r.slug)
  const label = nonEmptyString(r.label)
  const category = nonEmptyString(r.category)
  if (!slug || !label || !category) return null

  if (!Array.isArray(r.searchTerms)) return null
  const seen = new Set<string>()
  const searchTerms: string[] = []
  for (const term of r.searchTerms) {
    const clean = nonEmptyString(term)
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    searchTerms.push(clean)
  }
  if (searchTerms.length === 0) return null

  return { slug, label, category, searchTerms }
}

/**
 * Analisa defensivamente um objeto com a estrutura de ConditionsFile.
 *
 * Se o valor não for um objeto, se o array `conditions` estiver ausente/vazio ou
 * se todas as entradas estiverem malformadas, retorna uma lista `conditions` vazia
 * (com uma versão obtida da melhor forma possível), em vez de lançar uma exceção.
 * Assim, a página passa a oferecer apenas a busca por texto livre, em vez de falhar.
 * Em caso de slugs duplicados, mantém a PRIMEIRA ocorrência (a ordem selecionada
 * manualmente é intencional).
 */
export function parseConditionsFile(json: unknown): ConditionsFile {
  if (typeof json !== 'object' || json === null) {
    return { version: 'unknown', conditions: [] }
  }
  const root = json as Record<string, unknown>
  const version = nonEmptyString(root.version) ?? 'unknown'

  if (!Array.isArray(root.conditions)) {
    return { version, conditions: [] }
  }

  const seenSlugs = new Set<string>()
  const conditions: Condition[] = []
  for (const raw of root.conditions) {
    const entry = parseConditionEntry(raw)
    if (!entry) continue
    if (seenSlugs.has(entry.slug)) continue
    seenSlugs.add(entry.slug)
    conditions.push(entry)
  }

  return { version, conditions }
}

// ─── Busca + projeção ─────────────────────────────────────────────────────────

/** Encontra uma condição pelo slug (correspondência exata). Retorna null se não existir. */
export function findConditionBySlug(conditions: Condition[], slug: string): Condition | null {
  const target = slug.trim()
  if (!target) return null
  return conditions.find((c) => c.slug === target) ?? null
}

/** Converte uma Condition em um resumo destinado ao cliente (remove searchTerms). */
export function toConditionSummary(condition: Condition): ConditionSummary {
  return {
    slug: condition.slug,
    label: condition.label,
    category: condition.category,
  }
}

// ─── Relação inversa: texto de indicações → situações selecionadas ────────────

/**
 * A outra direção dessa relação de mão dupla: dado o texto de indicações e uso
 * de um medicamento, encontra quais situações selecionadas ele trata.
 *
 * Uma condição corresponde quando QUALQUER um de seus searchTerms aparece como
 * trecho de texto, sem diferenciar maiúsculas de minúsculas, no texto das indicações.
 * A correspondência por trecho (e não por limite de palavra ou FULLTEXT) reproduz
 * suficientemente a intenção da busca direta com FULLTEXT/LIKE para oferecer a opção
 * "Comumente usado para", mantendo a operação como uma simples manipulação de strings,
 * sem banco de dados. A ordem selecionada é preservada e os resultados são deduplicados por slug.
 *
 * Entrada em branco/vazia → [] (um rótulo sem indicações não corresponde a nenhuma situação aqui).
 */
export function situationsForIndications(
  indicationsText: string | null | undefined,
  conditions: Condition[]
): ConditionSummary[] {
  if (typeof indicationsText !== 'string') return []
  const haystack = indicationsText.toLowerCase()
  if (haystack.trim().length === 0) return []

  const matched: ConditionSummary[] = []
  const seen = new Set<string>()
  for (const condition of conditions) {
    if (seen.has(condition.slug)) continue
    const hit = condition.searchTerms.some((term) => {
      const needle = term.trim().toLowerCase()
      return needle.length > 0 && haystack.includes(needle)
    })
    if (hit) {
      seen.add(condition.slug)
      matched.push(toConditionSummary(condition))
    }
  }
  return matched
}

// ─── Construção da consulta FULLTEXT ──────────────────────────────────────────

/**
 * Cria uma string de consulta do MySQL em NATURAL LANGUAGE MODE a partir dos
 * searchTerms de uma condição.
 *
 * - Termos com várias palavras são colocados entre aspas duplas para que sejam
 *   encontrados como uma frase ("sore throat"), e não como dois tokens separados —
 *   isso troca um pouco de abrangência por maior precisão em condições com várias palavras.
 * - Termos com uma única palavra são passados sem aspas.
 * - Aspas duplas internas a um termo são removidas (elas quebrariam as aspas da frase).
 * - Termos duplicados são eliminados (sem diferenciar maiúsculas de minúsculas) e os
 *   vazios são descartados. Se todos estiverem vazios, retorna '' para que quem chamou
 *   a função possa recorrer diretamente à busca alternativa com LIKE.
 *
 * O NATURAL LANGUAGE MODE trata os termos unidos por espaços como uma consulta de
 * relevância semelhante a um OU, que é o comportamento desejado: qualquer sinônimo
 * pode revelar um rótulo correspondente, ordenado por relevância.
 */
export function buildIndicationQuery(searchTerms: string[]): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const raw of searchTerms) {
    if (typeof raw !== 'string') continue
    const term = raw.trim().replace(/"/g, '')
    if (term.length === 0) continue
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(/\s/.test(term) ? `"${term}"` : term)
  }
  return parts.join(' ')
}

// ─── Remédios naturais (Fase 2) — análise + busca ─────────────────────────────

/**
 * Valida e converte uma entrada bruta de remédio para o tipo NaturalRemedy.
 *
 * Retorna null quando a estrutura da entrada não pode ser usada (faltam campos de
 * texto obrigatórios ou o array conditions), permitindo que quem chamou a função
 * ignore a entrada em vez de exibir uma linha com erro. Segue a abordagem defensiva
 * de parseConditionEntry.
 */
export function parseRemedyEntry(raw: unknown): NaturalRemedy | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const slug = nonEmptyString(r.slug)
  const name = nonEmptyString(r.name)
  const uses = nonEmptyString(r.uses)
  const evidence = nonEmptyString(r.evidence)
  const cautions = nonEmptyString(r.cautions)
  const sourceUrl = nonEmptyString(r.sourceUrl)
  if (!slug || !name || !uses || !evidence || !cautions || !sourceUrl) return null

  if (!Array.isArray(r.commonNames)) return null
  const commonNames: string[] = []
  for (const cn of r.commonNames) {
    const clean = nonEmptyString(cn)
    if (clean) commonNames.push(clean)
  }

  if (!Array.isArray(r.conditions)) return null
  const conditions: string[] = []
  for (const c of r.conditions) {
    const clean = nonEmptyString(c)
    if (clean) conditions.push(clean)
  }
  // Um remédio sem condições nunca será exibido — descarte-o.
  if (conditions.length === 0) return null

  // Instruções práticas opcionais (o campo voltado ao uso offline) — incluídas quando presentes.
  const how = nonEmptyString(r.how)
  return how
    ? { slug, name, commonNames, conditions, uses, how, evidence, cautions, sourceUrl }
    : { slug, name, commonNames, conditions, uses, evidence, cautions, sourceUrl }
}

/**
 * Analisa defensivamente um objeto com a estrutura de NaturalRemediesFile.
 *
 * Se o valor não for um objeto, se o array `remedies` estiver ausente/vazio ou
 * se todas as entradas estiverem malformadas, retorna uma lista `remedies` vazia
 * (com uma versão obtida da melhor forma possível), em vez de lançar uma exceção.
 * Assim, a interface informa que não há remédios naturais para essa condição, em vez
 * de falhar. Em caso de slugs de remédios duplicados, mantém a PRIMEIRA ocorrência.
 */
export function parseNaturalRemediesFile(json: unknown): NaturalRemediesFile {
  const empty: NaturalRemediesFile = {
    version: 'unknown',
    source: { name: '', url: '', license: '' },
    remedies: [],
  }

  if (typeof json !== 'object' || json === null) return empty
  const root = json as Record<string, unknown>
  const version = nonEmptyString(root.version) ?? 'unknown'

  let source = { name: '', url: '', license: '' }
  if (typeof root.source === 'object' && root.source !== null) {
    const s = root.source as Record<string, unknown>
    source = {
      name: nonEmptyString(s.name) ?? '',
      url: nonEmptyString(s.url) ?? '',
      license: nonEmptyString(s.license) ?? '',
    }
  }

  if (!Array.isArray(root.remedies)) return { version, source, remedies: [] }

  const seenSlugs = new Set<string>()
  const remedies: NaturalRemedy[] = []
  for (const raw of root.remedies) {
    const entry = parseRemedyEntry(raw)
    if (!entry) continue
    if (seenSlugs.has(entry.slug)) continue
    seenSlugs.add(entry.slug)
    remedies.push(entry)
  }

  return { version, source, remedies }
}

/**
 * Retorna todos os remédios cujo array `conditions` contém o slug informado.
 *
 * A ordem é estável (preserva a ordem selecionada do array de remédios). Filtro puro
 * O(remedies) — sem banco de dados e sem correspondência aproximada. Retorna [] quando
 * nada corresponde ou quando o arquivo não contém remédios.
 */
export function remediesForCondition(file: NaturalRemediesFile, slug: string): NaturalRemedy[] {
  const target = slug.trim()
  if (!target) return []
  return file.remedies.filter((r) => r.conditions.includes(target))
}

/**
 * Atribuição curta e adequada à exibição da fonte de um remédio — texto simples,
 * NÃO um link. O NOMAD prioriza o uso offline: os cartões de remédios contêm tudo
 * o que é necessário para agir e nunca direcionam para a internet; esse crédito
 * atende à atribuição de domínio público sem sugerir que há conexão.
 */
export function remedySourceName(remedy: { kind?: 'herb' | 'self-care'; sourceUrl: string }): string {
  if ((remedy.kind ?? 'herb') === 'herb') return 'NCCIH'
  const url = remedy.sourceUrl.toLowerCase()
  if (url.includes('cdc.gov')) return 'CDC'
  if (url.includes('fda.gov')) return 'FDA'
  if (url.includes('medlineplus.gov')) return 'MedlinePlus (NLM)'
  if (url.includes('nih.gov')) return 'NIH'
  return 'Fonte do governo dos EUA'
}

/**
 * Retorna todos os remédios que correspondem a uma consulta de texto livre,
 * como alternativa secundária.
 *
 * Busca por trecho de texto, sem diferenciar maiúsculas de minúsculas, nos campos
 * `name` e `uses`. É usada quando uma consulta de texto livre não corresponde a um
 * slug de condição selecionada. Os resultados são deduplicados por slug.
 */
export function remediesForFreeText(file: NaturalRemediesFile, query: string): NaturalRemedy[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const seen = new Set<string>()
  const results: NaturalRemedy[] = []
  for (const r of file.remedies) {
    if (seen.has(r.slug)) continue
    if (r.name.toLowerCase().includes(q) || r.uses.toLowerCase().includes(q)) {
      seen.add(r.slug)
      results.push(r)
    }
  }
  return results
}

// ─── Ordenação dos resultados ─────────────────────────────────────────────────

/**
 * Ordena os resultados de medicamentos de forma estável, priorizando os de venda livre (OTC).
 *
 * A navegação por condições é voltada ao público geral, portanto os produtos vendidos
 * sem receita são os mais acessíveis e aparecem primeiro. A ordem dentro de cada grupo
 * (OTC → outros → Rx) é preservada conforme a entrada (que o serviço já ordena por
 * relevância); assim, esta função apenas reorganiza os grupos por product_type, sem
 * alterar a ordem de relevância.
 *
 * Agrupamento: OTC = 0, itens que não são nem Rx nem OTC = 1, Rx = 2. Retorna um novo
 * array; a entrada não é modificada.
 */
export function orderOtcFirst(drugs: DrugSearchResult[]): DrugSearchResult[] {
  const rank = (d: DrugSearchResult): number => {
    if (d.product_type === OTC_PRODUCT_TYPE) return 0
    if (d.product_type === RX_PRODUCT_TYPE) return 2
    return 1
  }
  return drugs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
    .map((x) => x.d)
}
