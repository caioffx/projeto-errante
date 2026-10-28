/**
 * Referência de medicamentos v1 — funções auxiliares puras e testáveis por unidade.
 *
 * NÃO importa Lucid / AdonisJS / HTTP. Estas funções recebem objetos simples e
 * retornam objetos simples, permitindo sua execução com @japa/runner sem inicializar
 * MySQL ou Redis. Segue o padrão de `embed_jobs.ts`.
 */

import path from 'node:path'
import type {
  DrugLabelManifest,
  DrugLabelPartition,
  DownloadStateMarker,
  DrugDownloadStatus,
  DrugIngestPhaseStatus,
  DrugIngestPhase,
} from '../types/drug_reference.js'

// ─── Tipos estruturais internos (sem Lucid) ──────────────────────────────────

/**
 * Estrutura de um registro de rótulo da openFDA — apenas os campos necessários.
 * Declarada localmente (sem importações de Lucid) para manter pura a função de mapeamento.
 */
export interface OpenFdaLabelRecord {
  set_id?: string
  id?: string
  version?: string
  effective_time?: string
  openfda?: {
    brand_name?: string[]
    generic_name?: string[]
    manufacturer_name?: string[]
    product_ndc?: string[]
    route?: string[]
    product_type?: string[]
  }
  indications_and_usage?: string[]
  dosage_and_administration?: string[]
  warnings?: string[]
  boxed_warning?: string[]
  drug_interactions?: string[]
  contraindications?: string[]
  when_using?: string[]
  stop_use?: string[]
}

/** Objeto de linha simples que corresponde à estrutura de colunas do modelo Lucid DrugLabel. */
export interface DrugLabelRow {
  set_id: string
  spl_id: string | null
  version: string | null
  brand_name: string | null
  generic_name: string | null
  manufacturer: string | null
  product_ndc: string | null
  route: string | null
  product_type: string | null
  searchable_name: string | null
  indications: string | null
  dosage: string | null
  warnings: string | null
  boxed_warning: string | null
  drug_interactions: string | null
  contraindications: string | null
  when_using: string | null
  stop_use: string | null
  source_updated_at: string | null // ISO date YYYY-MM-DD or null
}

// ─── Funções auxiliares internas ──────────────────────────────────────────────

/**
 * Achata um array de seção: junta os elementos com "\n\n" e remove espaços
 * excedentes nas extremidades. Uma chave ausente ou um array vazio retorna null
 * (nunca uma string vazia).
 */
function flattenSection(arr: string[] | undefined): string | null {
  if (!arr || arr.length === 0) return null
  const joined = arr.join('\n\n').trim()
  return joined.length > 0 ? joined : null
}

/**
 * Retorna o primeiro elemento de um array ou null se estiver ausente/vazio.
 */
function firstOf(arr: string[] | undefined): string | null {
  if (!arr || arr.length === 0) return null
  return arr[0] ?? null
}

/**
 * Junta os elementos de um array usando ", " ou retorna null se estiver ausente/vazio.
 */
function joinOf(arr: string[] | undefined): string | null {
  if (!arr || arr.length === 0) return null
  const joined = arr.join(', ').trim()
  return joined.length > 0 ? joined : null
}

/**
 * Converte effective_time da openFDA (YYYYMMDD) para uma data ISO YYYY-MM-DD.
 * Retorna null se o valor estiver ausente, não for uma string ou tiver formato inválido.
 */
function parseEffectiveTime(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  // Deve conter exatamente 8 dígitos
  if (!/^\d{8}$/.test(raw)) return null
  const year = raw.slice(0, 4)
  const month = raw.slice(4, 6)
  const day = raw.slice(6, 8)
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)
  // Verificação básica: ano dentro de uma faixa plausível para a FDA, mês de 1 a 12 e dia de 1 a 31
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${year}-${month}-${day}`
}

/**
 * Trunca uma string até um comprimento máximo (os limites das colunas varchar de
 * drug_labels). A openFDA combina campos com vários valores — por exemplo, todos
 * os princípios ativos em generic_name —, o que pode exceder o limite da coluna.
 * Limitar o comprimento aqui mantém a linha apta para inserção, evitando que um
 * único valor longo demais faça falhar (e descarte) todo um lote de upsert com
 * 500 linhas. O conteúdo das seções usa mediumtext e nunca é truncado.
 */
function clamp(value: string | null, max: number): string | null {
  if (value === null) return null
  return value.length > max ? value.slice(0, max) : value
}

/** Limites das colunas varchar de drug_labels — devem corresponder à migração. */
const COL = {
  SET_ID: 64,
  SPL_ID: 64,
  VERSION: 16,
  BRAND: 255,
  GENERIC: 512,
  MANUFACTURER: 512,
  PRODUCT_NDC: 255,
  ROUTE: 255,
  PRODUCT_TYPE: 32,
  SEARCHABLE: 768,
} as const

// ─── Funções auxiliares exportadas ─────────────────────────────────────────────

/**
 * Converte um registro bruto de rótulo da openFDA em um DrugLabelRow plano para upsert.
 *
 * Retorna null quando o registro não possui um `set_id` válido (a chave de
 * idempotência); o pipeline de ingestão ignora esses registros e incrementa
 * `recordsSkipped`.
 *
 * Os campos limitados por varchar têm seu comprimento ajustado aos limites das
 * respectivas colunas, evitando que um valor longo demais faça o lote de upsert
 * falhar. Todos os campos de seção são opcionais (em muitos registros, as chaves
 * estão ausentes, em vez de conter arrays vazios — verificado em registros OTC reais).
 */
export function mapDrugLabelRecord(record: OpenFdaLabelRecord): DrugLabelRow | null {
  if (!record.set_id || record.set_id.trim() === '') return null
  const setId = record.set_id.trim()
  // set_id é a chave de idempotência ÚNICA — nunca o trunque, pois uma chave
  // truncada poderia colidir com a de outro rótulo. Os set_ids da openFDA são GUIDs
  // de 36 caracteres; portanto, esta verificação é preventiva, não um caso esperado.
  if (setId.length > COL.SET_ID) return null

  const brand = firstOf(record.openfda?.brand_name)
  const generic = joinOf(record.openfda?.generic_name)

  return {
    set_id: setId,
    spl_id: clamp(record.id ?? null, COL.SPL_ID),
    version: clamp(record.version ?? null, COL.VERSION),
    brand_name: clamp(brand, COL.BRAND),
    generic_name: clamp(generic, COL.GENERIC),
    manufacturer: clamp(firstOf(record.openfda?.manufacturer_name), COL.MANUFACTURER),
    product_ndc: clamp(joinOf(record.openfda?.product_ndc), COL.PRODUCT_NDC),
    route: clamp(joinOf(record.openfda?.route), COL.ROUTE),
    product_type: clamp(firstOf(record.openfda?.product_type), COL.PRODUCT_TYPE),
    searchable_name: clamp(normalizeDrugName(brand, generic), COL.SEARCHABLE),
    indications: flattenSection(record.indications_and_usage),
    dosage: flattenSection(record.dosage_and_administration),
    warnings: flattenSection(record.warnings),
    boxed_warning: flattenSection(record.boxed_warning),
    drug_interactions: flattenSection(record.drug_interactions),
    contraindications: flattenSection(record.contraindications),
    when_using: flattenSection(record.when_using),
    stop_use: flattenSection(record.stop_use),
    source_updated_at: parseEffectiveTime(record.effective_time),
  }
}

/**
 * Normaliza os nomes comercial e genérico em uma única sequência pesquisável.
 *
 * Combina as duas strings, converte para minúsculas, substitui caracteres que não
 * são alfanuméricos por espaços, reduz sequências de espaços em branco, remove
 * tokens duplicados (preservando a ordem) e elimina espaços nas extremidades.
 * Se ambos forem null/vazios, retorna null.
 *
 * Exemplo: ("Tylenol Extra Strength", "acetaminophen") → "tylenol extra strength acetaminophen"
 * Exemplo: ("Silicea", "SILICEA") → "silicea" (duplicatas removidas)
 */
export function normalizeDrugName(
  brand: string | null,
  generic: string | null
): string | null {
  const parts: string[] = []
  if (brand && brand.trim().length > 0) parts.push(brand.trim())
  if (generic && generic.trim().length > 0) parts.push(generic.trim())
  if (parts.length === 0) return null

  const combined = parts.join(' ')
  // Converte para minúsculas e substitui caracteres não alfanuméricos por espaços
  const normalized = combined.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  // Divide em tokens e remove duplicatas, preservando a ordem da primeira ocorrência
  const rawTokens = normalized.split(/\s+/).filter((t) => t.length > 0)
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const token of rawTokens) {
    if (!seen.has(token)) {
      seen.add(token)
      deduped.push(token)
    }
  }

  const result = deduped.join(' ').trim()
  return result.length > 0 ? result : null
}

/**
 * Analisa o manifesto download.json e o converte em um DrugLabelManifest tipado.
 *
 * Lança um erro descritivo se:
 *   - `results.drug.label` estiver ausente (a estrutura do manifesto mudou na origem)
 *   - O array `partitions` estiver ausente ou vazio
 *
 * Partições sem o campo `file` são ignoradas, e um aviso é registrado em stderr
 * para que quem chamou a função possa decidir se deve interromper o processo.
 *
 * @param json - O objeto JSON analisado, obtido por GET https://api.fda.gov/download.json
 */
export function parseDrugLabelManifest(json: unknown): DrugLabelManifest {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Formato inesperado do manifesto da FDA: a raiz não é um objeto')
  }

  const root = json as Record<string, unknown>
  const results = root['results'] as Record<string, unknown> | undefined
  if (!results || typeof results !== 'object') {
    throw new Error('Formato inesperado do manifesto da FDA: campo "results" ausente')
  }

  const drug = results['drug'] as Record<string, unknown> | undefined
  if (!drug || typeof drug !== 'object') {
    throw new Error('Formato inesperado do manifesto da FDA: campo "results.drug" ausente')
  }

  const label = drug['label'] as Record<string, unknown> | undefined
  if (!label || typeof label !== 'object') {
    throw new Error('Formato inesperado do manifesto da FDA: campo "results.drug.label" ausente')
  }

  const export_date = label['export_date']
  if (typeof export_date !== 'string' || export_date.trim() === '') {
    throw new Error('Formato inesperado do manifesto da FDA: "export_date" ausente ou inválido')
  }

  const total_records = label['total_records']
  if (typeof total_records !== 'number') {
    throw new Error('Formato inesperado do manifesto da FDA: "total_records" ausente ou inválido')
  }

  const rawPartitions = label['partitions']
  if (!Array.isArray(rawPartitions) || rawPartitions.length === 0) {
    throw new Error(
      'Formato inesperado do manifesto da FDA: "partitions" ausente ou vazio'
    )
  }

  const partitions: DrugLabelPartition[] = []
  for (const p of rawPartitions as unknown[]) {
    if (typeof p !== 'object' || p === null) {
      process.stderr.write('[parseDrugLabelManifest] Ignorando partição que não é um objeto\n')
      continue
    }
    const part = p as Record<string, unknown>
    if (typeof part['file'] !== 'string' || (part['file'] as string).trim() === '') {
      process.stderr.write(
        `[parseDrugLabelManifest] Ignorando partição sem o campo "file": ${JSON.stringify(part)}\n`
      )
      continue
    }
    partitions.push({
      display_name: typeof part['display_name'] === 'string' ? part['display_name'] : '',
      file: (part['file'] as string).trim(),
      size_mb: typeof part['size_mb'] === 'string' ? part['size_mb'] : '0',
      records: typeof part['records'] === 'number' ? part['records'] : 0,
    })
  }

  if (partitions.length === 0) {
    throw new Error(
      'Formato inesperado do manifesto da FDA: todas as partições são inválidas (campo "file" ausente)'
    )
  }

  return {
    export_date: export_date.trim(),
    total_records,
    partitions,
  }
}

// ─── Funções auxiliares da ingestão em duas etapas (puras — sem E/S) ──────────

/**
 * Determina o caminho em disco do arquivo zip de uma parte a partir da partição
 * correspondente no manifesto.
 *
 * A tarefa de download salva cada parte em `<storageBase>/<nome-base-da-URL-do-arquivo>`;
 * tanto a tarefa de download (escrita) quanto a tarefa de ingestão (leitura) devem
 * usar esse mesmo caminho. Defini-lo aqui (função pura: path.basename e path.join
 * não realizam E/S) permite que ambas as tarefas e os testes compartilhem uma única
 * definição, em vez de repetir a junção dos caminhos duas vezes.
 */
export function partZipPath(storageBase: string, partition: DrugLabelPartition): string {
  return path.join(storageBase, path.basename(partition.file))
}

/**
 * Soma os valores `size_mb` das partições do manifesto e calcula o total em bytes
 * usado em `totalBytes` no cartão de downloads ativos. No manifesto da openFDA,
 * `size_mb` é uma string que representa megabytes; um valor ausente ou não numérico
 * contribui com 0, para que uma única partição inválida não torne o total inteiro
 * igual a NaN. A função é pura (sem E/S), permitindo que o produtor e o teste
 * independente compartilhem a mesma definição.
 */
export function manifestBytesTotal(manifest: DrugLabelManifest): number {
  return manifest.partitions.reduce((acc, p) => {
    const mb = Number(p.size_mb)
    return acc + (Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : 0)
  }, 0)
}

/**
 * Verifica se a `export_date` do manifesto é mais recente que a data da última
 * ingestão. Essa verificação determina se os dados dos medicamentos precisam
 * ser atualizados automaticamente.
 *
 * TODO(responsável pela manutenção, T3): CONFIRMAR o formato da string
 * `export_date` da openFDA antes de confiar neste comportamento. No código, ela
 * está tipada apenas como `string`; o formato (por exemplo, `YYYY-MM-DD`,
 * `YYYYMMDD` ou `MM/DD/YYYY`) determina se uma comparação lexicográfica simples
 * com `>` ordena as datas cronologicamente. Esta implementação é defensiva:
 * PRIMEIRO tenta usar Date.parse nos dois valores e compara os timestamps (o que
 * funciona para strings de data que possam ser analisadas, incluindo formatos ISO
 * e dos EUA); somente se UM DOS lados não puder ser analisado, recorre a uma
 * comparação lexicográfica após remover espaços nas extremidades (correta para
 * formatos ISO com zeros à esquerda, como `YYYY-MM-DD` e `YYYYMMDD`). A alternativa
 * pode falhar com formatos que não sejam ISO e não possam ser analisados; por isso
 * é necessária a confirmação de quem mantém o código. Em qualquer caso, não lança
 * erros e considera um valor `last` ausente/vazio como "mais recente" (uma primeira
 * instalação sem referência anterior deve atualizar os dados). Função pura: sem E/S
 * e totalmente testável por unidade.
 */
export function isExportDateNewer(latest: string, last: string | null | undefined): boolean {
  const l = (latest ?? '').trim()
  const prev = (last ?? '').trim()
  if (l === '') return false // sem valor candidato → nada para atualizar
  if (prev === '') return true // sem referência anterior → considerar qualquer candidato válido como mais recente
  if (l === prev) return false // valores idênticos → já está atualizado

  const lt = Date.parse(l)
  const pt = Date.parse(prev)
  if (Number.isFinite(lt) && Number.isFinite(pt)) {
    return lt > pt
  }
  // Alternativa: comparação lexicográfica. Só funciona corretamente com strings ISO ordenáveis e preenchidas com zeros.
  return l > prev
}

/**
 * Analisa defensivamente o marcador KV `drugReference.downloadState`.
 *
 * Segue a convenção de análise defensiva de kv_store: um valor nunca definido
 * (null), um JSON malformado ou um objeto com estrutura incorreta retornam null,
 * permitindo que quem chamou a função use a alternativa "nada foi baixado" em
 * vez de lançar um erro. Um marcador válido precisa conter um array `parts` não
 * vazio, com um caminho em formato string em cada entrada.
 */
export function parseDownloadState(raw: string | null): DownloadStateMarker | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const m = parsed as Record<string, unknown>
  if (typeof m.export_date !== 'string') return null
  if (typeof m.totalParts !== 'number') return null
  if (!Array.isArray(m.parts) || m.parts.length === 0) return null

  const parts: DownloadStateMarker['parts'] = []
  for (const p of m.parts as unknown[]) {
    if (typeof p !== 'object' || p === null) return null
    const part = p as Record<string, unknown>
    if (typeof part.path !== 'string' || part.path.trim() === '') return null
    parts.push({
      index: typeof part.index === 'number' ? part.index : parts.length,
      name: typeof part.name === 'string' ? part.name : '',
      path: part.path,
      bytes: typeof part.bytes === 'number' ? part.bytes : 0,
    })
  }

  return {
    export_date: m.export_date,
    totalParts: m.totalParts,
    // Marcadores antigos (gravados antes da existência de totalRecords) são
    // interpretados como 0 = "desconhecido"; nesse caso, quem chamou a função
    // usa uma estimativa baseada no número de partes.
    totalRecords: typeof m.totalRecords === 'number' ? m.totalRecords : 0,
    parts,
    completedAtMs: typeof m.completedAtMs === 'number' ? m.completedAtMs : 0,
  }
}

/**
 * Determina o denominador do "total esperado" da ingestão — cerca de 259 mil,
 * usado no contador "X de ~N rótulos", no percentual de progresso baseado em
 * registros e na estimativa de tempo restante (ETA).
 *
 * Prioridade (o primeiro valor conhecido vence; "conhecido" significa > 0):
 *   1. o valor real de `total_records` do manifesto (cerca de 259 mil), recebido
 *      nos dados da tarefa durante a execução encadeada automaticamente ou
 *      reconstruído a partir do marcador de download persistido;
 *   2. uma estimativa baseada nas partes (`totalParts * 20000`) quando o total do
 *      manifesto ainda não é conhecido (por exemplo, em um marcador antigo ou
 *      antes de o manifesto ser resolvido);
 *   3. a contagem atual de linhas, como último recurso.
 *
 * Correção de um erro: `total_records ?? fallback` retorna 0 quando
 * total_records é 0, porque 0 não é nullish (nulo ou indefinido). Assim, a
 * alternativa nunca era usada, e o contador, o percentual e a ETA desapareciam
 * silenciosamente. Tratar 0 como "desconhecido" restaura essas informações.
 */
export function resolveExpectedTotal(
  manifestTotalRecords: number | undefined,
  totalParts: number | undefined,
  rowCount: number,
  perPartEstimate = 20000
): number {
  if (manifestTotalRecords && manifestTotalRecords > 0) return manifestTotalRecords
  if (totalParts && totalParts > 0) return totalParts * perPartEstimate
  return rowCount
}

/**
 * Determina a contagem de registros ingeridos exibida pela interface durante a
 * fase 'ingesting'.
 *
 * Erro corrigido: o contador `recordsIngested` de cada tarefa fica atrasado
 * durante a transferência para a continuação da ingestão de cada parte. A etapa
 * 0 é executada com um jobId determinístico e armazena sua contagem nos dados da
 * tarefa; as continuações (partes 2 em diante) usam IDs automáticos e conhecem
 * apenas o total acumulado gravado nos *dados de suas próprias tarefas* durante
 * o lote. Por isso, o número mostrado pela leitura de status pode ficar parado
 * enquanto o banco de dados continua recebendo registros.
 *
 * A contagem atual de linhas de `drug_labels` é a fonte de verdade, mas só indica
 * fielmente o progresso na PRIMEIRA ingestão: uma tabela vazia (ou quase vazia)
 * cresce de 0 para cerca de 259 mil linhas à medida que os registros chegam.
 * Em uma nova ingestão sobre uma tabela já preenchida, a contagem quase não muda
 * (os upserts substituem linhas existentes), então ela subestimaria o progresso;
 * nesse caso, `recordsIngested` por tarefa é uma fonte melhor.
 *
 * `startRowCount` é a contagem de linhas da tabela quando ESTA EXECUÇÃO começou
 * (a etapa 0 a grava nos dados da tarefa; as continuações a carregam consigo).
 * Isso corrige a informação enganosa em novas ingestões: em uma tabela já
 * preenchida, usar rowCount diretamente fazia o contador mostrar cerca de 100%
 * desde o primeiro segundo. O indicador de progresso da tabela para esta execução
 * é rowCount - startRowCount (somente linhas novas); jobRecords cobre o caso em
 * que os upserts atualizam linhas existentes e a contagem da tabela quase não
 * muda. Usando o maior dos dois valores:
 *   - primeira ingestão (start 0): equivale ao antigo max(jobRecords, rowCount);
 *   - nova ingestão: rowCount - start fica próximo de 0, enquanto jobRecords
 *     cresce de 0 para cerca de 259 mil e alimenta o contador corretamente.
 *
 * O valor é limitado a `expectedTotal` (quando conhecido), para impedir que a
 * contagem ultrapasse momentaneamente o denominador e faça a barra passar de 100%.
 */
export function resolveIngestRecordsShown(
  jobRecords: number,
  rowCount: number,
  expectedTotal: number,
  startRowCount = 0
): number {
  const newRows = Math.max(0, rowCount - Math.max(0, startRowCount))
  const best = Math.max(jobRecords, newRows)
  if (expectedTotal > 0) return Math.min(best, expectedTotal)
  return best
}

/**
 * Reduz uma mensagem bruta de falha de tarefa a um texto legível para a interface.
 *
 * Uma mensagem de erro do knex/mysql2 inclui a instrução SQL INTEIRA que falhou.
 * Em uma inserção de 500 rótulos de medicamentos, isso pode significar milhares de
 * caracteres de SQL mais o texto completo dos rótulos, que o painel de status
 * acabava exibindo sem alterações (um enorme bloco vermelho). A parte relevante
 * é o erro do driver acrescentado pelo banco de dados NO FINAL ("Duplicate entry
 * … for key …", "Data too long for column …" etc.).
 *
 * Estratégia: procurar na mensagem os formatos conhecidos de erros do driver
 * MySQL e retornar apenas a frase correspondente; se nenhum for encontrado, usar
 * a primeira linha, com um limite rígido de caracteres. Função pura e testável
 * por unidade.
 */
export function summarizeJobError(raw: string | null | undefined, maxLen = 300): string | undefined {
  if (!raw) return undefined
  const msg = String(raw).trim()
  if (!msg) return undefined

  const driverPatterns: RegExp[] = [
    /Duplicate entry .{0,120}? for key '[^']+'/,
    /Data too long for column '[^']+'[^\n]{0,80}/,
    /Incorrect \w+ value: .{0,120}/,
    /Unknown column '[^']+' in '[^']+'/,
    /Deadlock found[^\n]{0,120}/,
    /Lock wait timeout[^\n]{0,120}/,
    /ER_[A-Z_]+[^\n]{0,160}/,
    /connect ECONNREFUSED [^\s]+/,
    /timed out after \d+ms[^\n]{0,160}/,
  ]
  for (const pat of driverPatterns) {
    const m = msg.match(pat)
    if (m) return m[0].slice(0, maxLen)
  }

  // Nenhum erro reconhecido do driver — usa a primeira linha, com limite de
  // caracteres. Um trecho iniciado por "insert into `drug_labels` (…)" fica
  // inteiro em uma única linha; por isso, o limite é o que protege a interface.
  const firstLine = msg.split('\n')[0]
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen)}…` : firstLine
}

/**
 * Determina a fase geral da ingestão a partir dos estados das duas subfases e da
 * contagem atual de linhas. Esta é a máquina de estados usada pela interface:
 *
 *   - ingestão em andamento                    → 'ingesting'
 *   - download em andamento                    → 'downloading'
 *   - qualquer fase falhou (ingestão prevalece) → 'failed'
 *   - ingestão concluída (ou já existem linhas
 *     sem trabalho ativo)                      → 'ready'
 *   - download concluído, ingestão pendente    → 'downloaded'
 *   - nenhuma atividade e nenhuma linha        → 'idle'
 *
 * A ordem é importante: uma fase em andamento é informada antes de uma fase
 * terminal, para que uma nova ingestão após um sucesso anterior apareça como
 * 'ingesting', e não como 'ready'. Uma falha no download NÃO faz a fase de
 * ingestão falhar automaticamente (e vice-versa): somente a fase que realmente
 * falhou é exibida, e uma fase em andamento sempre tem prioridade sobre a falha
 * da outra fase.
 */
export function deriveIngestPhase(
  download: DrugDownloadStatus,
  ingest: DrugIngestPhaseStatus,
  rowCount: number
): DrugIngestPhase {
  if (ingest.state === 'running') return 'ingesting'
  if (download.state === 'running') return 'downloading'
  // A partir deste ponto, nenhuma fase está em execução.
  if (ingest.state === 'failed') return 'failed'
  if (download.state === 'failed') return 'failed'
  if (ingest.state === 'completed') return 'ready'
  if (download.state === 'completed') return 'downloaded'
  // Inatividade: exibe 'ready' se já houver dados pesquisáveis de uma execução anterior.
  if (rowCount > 0) return 'ready'
  return 'idle'
}
