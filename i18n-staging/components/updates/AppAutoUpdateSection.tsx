import { useTranslation } from 'react-i18next'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import Switch from '~/components/inputs/Switch'
import api from '~/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/NotificationContext'
import { useAppAutoUpdateStatus } from '~/hooks/useAppAutoUpdateStatus'

export default function AppAutoUpdateSection() {
  const { t } = useTranslation('updates')
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useAppAutoUpdateStatus()

  const enabled = status?.enabled ?? false

  const toggleMutation = useMutation({
    mutationFn: (value: boolean) => api.updateSetting('appAutoUpdate.enabled', value),
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ['app-auto-update-status'] })
      addNotification({
        type: 'success',
        message: value ? t('app.enabled_success') : t('app.disabled_success'),
      })
    },
    onError: () => {
      addNotification({ type: 'error', message: t('app.toggle_error') })
    },
  })

  return (
    <>
      <StyledSectionHeader title={t('app.title')} className="mt-8" />
      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden mt-6 p-6">
        <Switch
          checked={enabled}
          onChange={(value) => toggleMutation.mutate(value)}
          disabled={toggleMutation.isPending || isLoading}
          label={t('app.enable_label')}
          description={t('app.enable_desc')}
        />

        {enabled && status && (
          <div className="mt-6 pt-4 border-t border-desert-stone-light text-sm">
            <p className="text-desert-stone mb-3">
              {t('app.window_info', {
                start: status.windowStart,
                end: status.windowEnd,
                status: status.withinWindow ? t('app.currently_inside') : t('app.currently_outside'),
                hours: status.cooloffHours,
              })}
              {status.lastResult && (
                <>
                  {' '}
                  <span className="font-medium">{t('app.last_run')}</span>
                  {status.lastResult}
                  {status.lastAttemptAt
                    ? ` (${new Date(status.lastAttemptAt).toLocaleString()})`
                    : ''}
                </>
              )}
            </p>

            {status.apps.length === 0 ? (
              <p className="text-desert-stone-dark">
                {t('app.no_apps')}
              </p>
            ) : (
              <ul className="space-y-2">
                {status.apps.map((app) => (
                  <li
                    key={app.service_name}
                    className="flex items-start justify-between gap-4 rounded-md bg-surface-secondary px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-text-primary">
                        {app.friendly_name || app.service_name}
                      </p>
                      <p className="text-desert-stone">
                        {app.current_version}
                        {app.available_update_version
                          ? ` → ${app.available_update_version}`
                          : ` ${t('app.up_to_date')}`}
                      </p>
                      {app.auto_disabled_reason && (
                        <p className="text-desert-red mt-0.5">{app.auto_disabled_reason}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        app.eligible ? 'text-desert-green' : 'text-desert-stone'
                      }`}
                    >
                      {app.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  )
}
