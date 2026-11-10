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
import { useContentAutoUpdateStatus } from '~/hooks/useContentAutoUpdateStatus'
import { formatBytes } from '~/lib/util'

const BYTES_PER_GB = 1024 * 1024 * 1024

export default function ContentAutoUpdateSection() {
  const { t } = useTranslation('updates')
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useContentAutoUpdateStatus()

  const cooloffOptions = [
    { value: 24, label: t('cooloff.24h') },
    { value: 48, label: t('cooloff.48h') },
    { value: 72, label: t('cooloff.72h') },
    { value: 168, label: t('cooloff.168h') },
  ]

  const [windowStart, setWindowStart] = useState('02:00')
  const [windowEnd, setWindowEnd] = useState('05:00')
  const [cooloff, setCooloff] = useState(72)
  const [capGb, setCapGb] = useState('0')

  useEffect(() => {
    if (status) {
      setWindowStart(status.windowStart)
      setWindowEnd(status.windowEnd)
      setCooloff(status.cooloffHours)
      setCapGb(
        status.maxBytesPerWindow > 0
          ? String(Math.round((status.maxBytesPerWindow / BYTES_PER_GB) * 100) / 100)
          : '0'
      )
    }
  }, [status?.windowStart, status?.windowEnd, status?.cooloffHours, status?.maxBytesPerWindow])

  const enabled = status?.enabled ?? false
  const autoDisabled = !!status?.autoDisabledReason

  const toggleMutation = useMutation({
    mutationFn: (value: boolean) => api.updateSetting('contentAutoUpdate.enabled', value),
    onSuccess: (_data, value) => {
      queryClient.invalidateQueries({ queryKey: ['content-auto-update-status'] })
      addNotification({
        type: 'success',
        message: value
          ? t('content.enabled_success')
          : t('content.disabled_success'),
      })
    },
    onError: () => {
      addNotification({ type: 'error', message: t('content.toggle_error') })
    },
  })

  const handleSaveSchedule = async () => {
    const parsedGb = Number(capGb)
    if (!Number.isFinite(parsedGb) || parsedGb < 0) {
      addNotification({ type: 'error', message: t('content.data_cap_error') })
      return
    }
    const capBytes = Math.round(parsedGb * BYTES_PER_GB)
    try {
      await api.updateSetting('contentAutoUpdate.windowStart', windowStart)
      await api.updateSetting('contentAutoUpdate.windowEnd', windowEnd)
      await api.updateSetting('contentAutoUpdate.cooloffHours', String(cooloff))
      await api.updateSetting('contentAutoUpdate.maxBytesPerWindow', String(capBytes))
      queryClient.invalidateQueries({ queryKey: ['content-auto-update-status'] })
      addNotification({ type: 'success', message: t('content.save_success') })
    } catch {
      addNotification({ type: 'error', message: t('content.save_error') })
    }
  }

  return (
    <>
      <StyledSectionHeader title={t('content.title')} className="mt-8" />
      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden mt-6 p-6">
        {autoDisabled && (
          <Alert
            type="warning"
            title={t('content.disabled_alert_title')}
            message={
              status?.autoDisabledReason ||
              t('content.disabled_default')
            }
            variant="bordered"
            className="mb-4"
          />
        )}

        <Switch
          checked={enabled}
          onChange={(value) => toggleMutation.mutate(value)}
          disabled={toggleMutation.isPending || isLoading}
          label={t('content.enable_label')}
          description={t('content.enable_desc')}
        />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            name="contentWindowStart"
            label={t('core.window_start')}
            type="time"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            disabled={!enabled}
            helpText={t('core.server_time_help')}
          />
          <Input
            name="contentWindowEnd"
            label={t('core.window_end')}
            type="time"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            disabled={!enabled}
            helpText={t('core.server_time_help')}
          />
          <div>
            <label
              htmlFor="contentCooloff"
              className="block text-base/6 font-medium text-text-primary"
            >
              {t('core.cooloff_label')}
            </label>
            <p className="mt-1 text-sm text-text-muted">{t('content.cooloff_help')}</p>
            <select
              id="contentCooloff"
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
          <Input
            name="contentDataCap"
            label={t('content.data_cap_label')}
            type="number"
            min="0"
            step="1"
            value={capGb}
            onChange={(e) => setCapGb(e.target.value)}
            disabled={!enabled}
            helpText={t('content.data_cap_help')}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <StyledButton variant="primary" size="sm" onClick={handleSaveSchedule} disabled={!enabled}>
            {t('core.save_schedule')}
          </StyledButton>
        </div>

        {enabled && status && (
          <div className="mt-6 pt-4 border-t border-desert-stone-light text-sm">
            <p className="text-desert-stone mb-3">
              {t('content.window_info', {
                start: status.windowStart,
                end: status.windowEnd,
                status: status.withinWindow ? t('app.currently_inside') : t('app.currently_outside'),
                hours: status.cooloffHours,
                cap: status.maxBytesPerWindow > 0 ? formatBytes(status.maxBytesPerWindow) : t('content.unlimited'),
                used: status.maxBytesPerWindow > 0 ? t('content.used_info', { used: formatBytes(status.windowBytesUsed) }) : '',
              })}
              {status.lastResult && (
                <>
                  {' '}
                  <span className="font-medium">{t('content.last_run')}</span>
                  {status.lastResult}
                  {status.lastAttemptAt
                    ? ` (${new Date(status.lastAttemptAt).toLocaleString()})`
                    : ''}
                </>
              )}
            </p>

            {status.lastError && (
              <p className="text-desert-red mb-3">
                <span className="font-medium">{t('content.last_error')}</span>
                {status.lastError}
              </p>
            )}

            {status.resources.length === 0 ? (
              <p className="text-desert-stone-dark">
                {t('content.all_up_to_date')}
              </p>
            ) : (
              <ul className="space-y-2">
                {status.resources.map((resource) => (
                  <li
                    key={`${resource.resource_type}:${resource.resource_id}`}
                    className="flex items-start justify-between gap-4 rounded-md bg-surface-secondary px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-text-primary">
                        {resource.resource_id}{' '}
                        <span className="text-xs uppercase text-desert-stone">
                          {resource.resource_type}
                        </span>
                      </p>
                      <p className="text-desert-stone">
                        {resource.current_version}
                        {resource.available_update_version
                          ? ` → ${resource.available_update_version}`
                          : ` ${t('app.up_to_date')}`}
                        {resource.size_bytes ? ` · ${formatBytes(resource.size_bytes)}` : ''}
                      </p>
                      {resource.auto_disabled_reason && (
                        <p className="text-desert-red mt-0.5">{resource.auto_disabled_reason}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${resource.exceeds_cap
                          ? 'text-desert-red'
                          : resource.eligible
                            ? 'text-desert-green'
                            : 'text-desert-stone'
                        }`}
                    >
                      {resource.exceeds_cap ? t('content.exceeds_cap') : resource.reason}
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
