import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StyledButton from '~/components/StyledButton'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import Alert from '~/components/Alert'
import api from '~/lib/api'
import Input from '~/components/inputs/Input'
import Switch from '~/components/inputs/Switch'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/NotificationContext'
import { useAutoUpdateStatus } from '~/hooks/useAutoUpdateStatus'

export default function CoreAutoUpdateSection() {
  const { t } = useTranslation('updates')
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useAutoUpdateStatus()

  const cooloffOptions = [
    { value: 24, label: t('cooloff.24h') },
    { value: 48, label: t('cooloff.48h') },
    { value: 72, label: t('cooloff.72h') },
    { value: 168, label: t('cooloff.168h') },
  ]

  const [windowStart, setWindowStart] = useState('02:00')
  const [windowEnd, setWindowEnd] = useState('05:00')
  const [cooloff, setCooloff] = useState(72)

  // Seed editable fields once the persisted status loads.
  useEffect(() => {
    if (status) {
      setWindowStart(status.windowStart)
      setWindowEnd(status.windowEnd)
      setCooloff(status.cooloffHours)
    }
  }, [status?.windowStart, status?.windowEnd, status?.cooloffHours])

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) => api.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
    },
    onError: () => {
      addNotification({ type: 'error', message: t('core.toggle_error') })
    },
  })

  const enabled = status?.enabled ?? false
  const autoDisabled = !!status?.autoDisabledReason

  const handleToggle = (value: boolean) => {
    saveMutation.mutate(
      { key: 'autoUpdate.enabled', value },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
          addNotification({
            type: 'success',
            message: value ? t('core.enabled_success') : t('core.disabled_success'),
          })
        },
      }
    )
  }

  const handleSaveWindow = async () => {
    try {
      await api.updateSetting('autoUpdate.windowStart', windowStart)
      await api.updateSetting('autoUpdate.windowEnd', windowEnd)
      await api.updateSetting('autoUpdate.cooloffHours', String(cooloff))
      queryClient.invalidateQueries({ queryKey: ['auto-update-status'] })
      addNotification({ type: 'success', message: t('core.save_success') })
    } catch {
      addNotification({ type: 'error', message: t('core.save_error') })
    }
  }

  return (
    <>
      <StyledSectionHeader title={t('core.title')} className="mt-8" />
      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden mt-6 p-6">
        {autoDisabled && (
          <Alert
            type="warning"
            title={t('core.disabled_alert_title')}
            message={status?.autoDisabledReason || t('core.disabled_default')}
            variant="bordered"
            className="mb-4"
          />
        )}

        <Switch
          checked={enabled}
          onChange={handleToggle}
          disabled={saveMutation.isPending || isLoading}
          label={t('core.enable_label')}
          description={t('core.enable_desc')}
        />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            name="autoUpdateWindowStart"
            label={t('core.window_start')}
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            disabled={!enabled}
            helpText={t('core.server_time_help')}
          />
          <Input
            name="autoUpdateWindowEnd"
            label={t('core.window_end')}
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            disabled={!enabled}
            helpText={t('core.server_time_help')}
          />
          <div>
            <label
              htmlFor="autoUpdateCooloff"
              className="block text-base/6 font-medium text-text-primary"
            >
              {t('core.cooloff_label')}
            </label>
            <p className="mt-1 text-sm text-text-muted">{t('core.cooloff_help')}</p>
            <select
              id="autoUpdateCooloff"
              value={cooloff}
              onChange={(e) => setCooloff(Number(e.target.value))}
              disabled={!enabled}
              className="mt-1.5 block w-full rounded-md bg-surface-primary px-3 py-2 text-base text-text-primary border border-border-default focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6 disabled:opacity-50"
            >
              {cooloffOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <StyledButton
            variant="primary"
            size="sm"
            onClick={handleSaveWindow}
            disabled={!enabled}
          >
            {t('core.save_schedule')}
          </StyledButton>
        </div>

        {enabled && status && (
          <div className="mt-6 pt-4 border-t border-desert-stone-light text-sm space-y-1">
            <p className="text-desert-stone-dark">
              <span className="font-medium">{t('core.status_label')}</span>
              {status.eligibleTarget
                ? t('core.status_ready', { version: status.eligibleTarget.version })
                : t('core.status_none')}
            </p>
            <p className="text-desert-stone">
              <span className="font-medium">{t('core.window_label')}</span>
              {status.withinWindow ? t('core.inside_window') : t('core.outside_window')}
            </p>
            {status.lastResult && (
              <p className="text-desert-stone">
                <span className="font-medium">{t('core.last_check_label')}</span>
                {status.lastResult}
                {status.lastAttemptAt
                  ? ` (${new Date(status.lastAttemptAt).toLocaleString()})`
                  : ''}
              </p>
            )}
            {status.lastError && (
              <p className="text-desert-red">
                <span className="font-medium">{t('core.last_error_label')}</span>
                {status.lastError}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
