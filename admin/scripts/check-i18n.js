import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.resolve(__dirname, '../inertia/locales')
const enDir = path.join(localesDir, 'en')
const ptDir = path.join(localesDir, 'pt-BR')

function getKeys(obj, prefix = '') {
  let keys = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getKeys(v, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

const files = fs.readdirSync(enDir).filter((f) => f.endsWith('.json'))
let missingTotal = 0
let totalEnKeys = 0

console.log('🔍 Verificando paridade de chaves i18n (en -> pt-BR)...\n')

for (const file of files) {
  const enPath = path.join(enDir, file)
  const ptPath = path.join(ptDir, file)

  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'))
  const ptContent = fs.existsSync(ptPath) ? JSON.parse(fs.readFileSync(ptPath, 'utf-8')) : {}

  const enKeys = getKeys(enContent)
  const ptKeys = new Set(getKeys(ptContent))
  totalEnKeys += enKeys.length

  const missing = enKeys.filter((k) => !ptKeys.has(k))

  if (missing.length > 0) {
    missingTotal += missing.length
    console.log(`❌ [${file}] ${missing.length} chave(s) ausente(s) em pt-BR:`)
    for (const k of missing) {
      console.log(`   - ${k}`)
    }
  } else {
    console.log(`✅ [${file}] ${enKeys.length} chaves sincronizadas.`)
  }
}

console.log(`\nTotal de chaves em en: ${totalEnKeys}`)
if (missingTotal > 0) {
  console.log(`⚠️  Total de chaves pendentes em pt-BR: ${missingTotal}`)
  process.exit(1)
} else {
  console.log('🎉 Todas as chaves estão perfeitamente sincronizadas!')
}
