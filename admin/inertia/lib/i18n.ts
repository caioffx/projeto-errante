import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// English translations
import commonEn from '../locales/en/common.json'
import homeEn from '../locales/en/home.json'
import settingsEn from '../locales/en/settings.json'
import chatEn from '../locales/en/chat.json'
import supplyDepotEn from '../locales/en/supply_depot.json'
import mapsEn from '../locales/en/maps.json'
import drugReferenceEn from '../locales/en/drug_reference.json'
import easySetupEn from '../locales/en/easy_setup.json'
import benchmarkEn from '../locales/en/benchmark.json'
import contentEn from '../locales/en/content.json'
import updatesEn from '../locales/en/updates.json'
import errorsEn from '../locales/en/errors.json'
import docsEn from '../locales/en/docs.json'

// Portuguese (pt-BR) translations
import commonPtBR from '../locales/pt-BR/common.json'
import homePtBR from '../locales/pt-BR/home.json'
import settingsPtBR from '../locales/pt-BR/settings.json'
import chatPtBR from '../locales/pt-BR/chat.json'
import supplyDepotPtBR from '../locales/pt-BR/supply_depot.json'
import mapsPtBR from '../locales/pt-BR/maps.json'
import drugReferencePtBR from '../locales/pt-BR/drug_reference.json'
import easySetupPtBR from '../locales/pt-BR/easy_setup.json'
import benchmarkPtBR from '../locales/pt-BR/benchmark.json'
import contentPtBR from '../locales/pt-BR/content.json'
import updatesPtBR from '../locales/pt-BR/updates.json'
import errorsPtBR from '../locales/pt-BR/errors.json'
import docsPtBR from '../locales/pt-BR/docs.json'

export const defaultNS = 'common'

export const namespaces = [
  'common',
  'home',
  'settings',
  'chat',
  'supply_depot',
  'maps',
  'drug_reference',
  'easy_setup',
  'benchmark',
  'content',
  'updates',
  'errors',
  'docs',
] as const

export type AppNamespace = (typeof namespaces)[number]

export const resources = {
  en: {
    common: commonEn,
    home: homeEn,
    settings: settingsEn,
    chat: chatEn,
    supply_depot: supplyDepotEn,
    maps: mapsEn,
    drug_reference: drugReferenceEn,
    easy_setup: easySetupEn,
    benchmark: benchmarkEn,
    content: contentEn,
    updates: updatesEn,
    errors: errorsEn,
    docs: docsEn,
  },
  'pt-BR': {
    common: commonPtBR,
    home: homePtBR,
    settings: settingsPtBR,
    chat: chatPtBR,
    supply_depot: supplyDepotPtBR,
    maps: mapsPtBR,
    drug_reference: drugReferencePtBR,
    easy_setup: easySetupPtBR,
    benchmark: benchmarkPtBR,
    content: contentPtBR,
    updates: updatesPtBR,
    errors: errorsPtBR,
    docs: docsPtBR,
  },
} as const

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    defaultNS,
    ns: [...namespaces],
    interpolation: {
      escapeValue: false, // React escapa por padrão
    },
    react: {
      useSuspense: false, // A app Inertia.js não usa <Suspense> na raiz de roteamento
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    debug: import.meta.env.DEV,
  })

export default i18n
export { i18n }
