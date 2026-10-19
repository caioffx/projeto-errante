import { IconSun, IconMoon } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useThemeContext } from '~/providers/ThemeProvider'

interface ThemeToggleProps {
  compact?: boolean
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeContext()
  const { t } = useTranslation('common')
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors
                 text-desert-stone hover:text-desert-green-darker cursor-pointer"
      aria-label={isDark ? t('theme.switch_to_day') : t('theme.switch_to_night')}
      title={isDark ? t('theme.switch_to_day') : t('theme.switch_to_night')}
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
      {!compact && <span>{isDark ? t('theme.day_ops') : t('theme.night_ops')}</span>}
    </button>
  )
}

