import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePage } from '@inertiajs/react'
import { IconBrain } from '@tabler/icons-react'
import api from '~/lib/api'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import { useTranslation, Trans } from 'react-i18next'

export default function KbPolicyPromptBanner() {
  const { t } = useTranslation('chat')
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const aiAssistantName =
    usePage<{ aiAssistantName?: string }>().props?.aiAssistantName || 'AI Assistant'

  const { data: promptState } = useQuery({
    queryKey: ['kbPolicyPromptState'],
    queryFn: () => api.getKbPolicyPromptState(),
    staleTime: Infinity,
  })

  const indexNowMutation = useMutation({
    mutationFn: async () => {
      await api.updateSetting('rag.defaultIngestPolicy', 'Always')
      await api.syncRAGStorage()
    },
    onSuccess: () => {
      addNotification({
        type: 'success',
        message: t('kb_prompt_banner.index_started_msg', { name: aiAssistantName }),
      })
      queryClient.invalidateQueries({ queryKey: ['kbPolicyPromptState'] })
      queryClient.invalidateQueries({ queryKey: ['ingestPolicy'] })
      queryClient.invalidateQueries({ queryKey: ['embed-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['storedFiles'] })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error?.message || t('kb_prompt_banner.index_failed_msg'),
      })
    },
  })

  const maybeLaterMutation = useMutation({
    mutationFn: () => api.updateSetting('rag.defaultIngestPolicy', 'Manual'),
    onSuccess: () => {
      addNotification({
        type: 'success',
        message: t('kb_prompt_banner.maybe_later_msg'),
      })
      queryClient.invalidateQueries({ queryKey: ['kbPolicyPromptState'] })
      queryClient.invalidateQueries({ queryKey: ['ingestPolicy'] })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error?.message || t('kb_prompt_banner.save_choice_failed'),
      })
    },
  })

  if (!promptState?.shouldPrompt) return null

  const fileCount = promptState.totalFiles
  const isBusy = indexNowMutation.isPending || maybeLaterMutation.isPending

  return (
    <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <IconBrain className="h-6 w-6 text-blue-600 dark:text-blue-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary">
            <strong>
              {fileCount === 1
                ? t('kb_prompt_banner.title_single', { name: aiAssistantName })
                : t('kb_prompt_banner.title_plural', { count: fileCount.toLocaleString(), name: aiAssistantName })}
            </strong>
            {' '}{t('kb_prompt_banner.explanation', { name: aiAssistantName })}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <StyledButton
            onClick={() => indexNowMutation.mutate()}
            variant="primary"
            size="sm"
            disabled={isBusy}
            loading={indexNowMutation.isPending}
          >
            {t('kb_prompt_banner.btn_index_now')}
          </StyledButton>
          <StyledButton
            onClick={() => maybeLaterMutation.mutate()}
            variant="ghost"
            size="sm"
            disabled={isBusy}
            loading={maybeLaterMutation.isPending}
          >
            {t('kb_prompt_banner.btn_maybe_later')}
          </StyledButton>
        </div>
      </div>
    </div>
  )
}
