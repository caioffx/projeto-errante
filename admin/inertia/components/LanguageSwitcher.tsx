import { useTranslation } from 'react-i18next'
import { IconLanguage } from '@tabler/icons-react'

interface LanguageSwitcherProps {
  compact?: boolean
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language?.startsWith('pt') ? 'pt-BR' : 'en'

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'pt-BR' : 'en'
    i18n.changeLanguage(nextLang)
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors text-desert-stone hover:text-desert-green-darker cursor-pointer"
      aria-label="Switch Language"
      title={`Mudar idioma / Switch language (${currentLang === 'en' ? 'Português' : 'English'})`}
    >
      <IconLanguage className="size-4" />
      {!compact && <span className="font-medium uppercase">{currentLang === 'en' ? 'EN' : 'PT-BR'}</span>}
    </button>
  )
}
