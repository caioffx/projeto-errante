import { useEffect, useState } from 'react'
import { IconBug, IconCopy, IconCheck } from '@tabler/icons-react'
import StyledModal from './StyledModal'
import api from '~/lib/api'
import { useTranslation } from 'react-i18next'

interface DebugInfoModalProps {
  open: boolean
  onClose: () => void
}

export default function DebugInfoModal({ open, onClose }: DebugInfoModalProps) {
  const { t } = useTranslation('common')
  const [debugText, setDebugText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return

    setLoading(true)
    setCopied(false)

    api.getDebugInfo().then((text) => {
      if (text) {
        const browserLine = `Browser: ${navigator.userAgent}`
        setDebugText(text + '\n' + browserLine)
      } else {
        setDebugText(t('debug_modal.failed_to_load'))
      }
      setLoading(false)
    }).catch(() => {
      setDebugText(t('debug_modal.failed_to_load'))
      setLoading(false)
    })
  }, [open, t])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText)
    } catch {
      // Fallback for older browsers
      const textarea = document.querySelector<HTMLTextAreaElement>('#debug-info-text')
      if (textarea) {
        textarea.select()
        document.execCommand('copy')
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <StyledModal
      open={open}
      onClose={onClose}
      title={t('debug_modal.title')}
      icon={<IconBug className="size-8 text-desert-green" />}
      cancelText={t('buttons.close')}
      onCancel={onClose}
    >
      <p className="text-sm text-gray-500 mb-3 text-left">
        {t('debug_modal.description')}
      </p>

      <textarea
        id="debug-info-text"
        readOnly
        value={loading ? t('loading') : debugText}
        rows={18}
        className="w-full font-mono text-xs text-black bg-gray-50 border border-gray-200 rounded-md p-3 resize-none focus:outline-none text-left"
      />

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={handleCopy}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-desert-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-desert-green-dark transition-colors disabled:opacity-50"
        >
          {copied ? (
            <>
              <IconCheck className="size-4" />
              {t('buttons.copied')}
            </>
          ) : (
            <>
              <IconCopy className="size-4" />
              {t('buttons.copy_to_clipboard')}
            </>
          )}
        </button>

        <a
          href="https://github.com/Crosstalk-Solutions/project-nomad/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-desert-green hover:underline"
        >
          {t('debug_modal.open_github_issue')}
        </a>
      </div>
    </StyledModal>
  )
}
