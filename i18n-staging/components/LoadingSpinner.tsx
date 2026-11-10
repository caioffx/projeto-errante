import { useTranslation } from 'react-i18next'

interface LoadingSpinnerProps {
  text?: string
  fullscreen?: boolean
  iconOnly?: boolean
  light?: boolean
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  fullscreen = false,
  iconOnly = false,
  light = false,
  className,
}) => {
  const { t } = useTranslation('common')
  const defaultText = text || t('loading')

  if (!fullscreen) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div
          className={`w-8 h-8 border-[3px] ${light ? 'border-white' : 'border-text-muted'} border-t-transparent rounded-full animate-spin ${className || ''}`}
        ></div>
        {!iconOnly && (
          <div className={light ? 'text-white mt-2' : 'text-text-primary mt-2'}>
            {defaultText}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm ${className || ''}`}
    >
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
        {!iconOnly && <div className="text-white mt-3 font-medium">{defaultText}</div>}
      </div>
    </div>
  )
}

export default LoadingSpinner
