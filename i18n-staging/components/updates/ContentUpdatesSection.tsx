import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StyledButton from '~/components/StyledButton'
import StyledTable from '~/components/StyledTable'
import StyledSectionHeader from '~/components/StyledSectionHeader'
import ActiveDownloads from '~/components/ActiveDownloads'
import Alert from '~/components/Alert'
import type { ContentUpdateCheckResult, ResourceUpdateInfo } from '../../../types/collections'
import api from '~/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '~/context/NotificationContext'
import { formatBytes } from '~/lib/util'

export default function ContentUpdatesSection() {
  const { t } = useTranslation('updates')
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [checkResult, setCheckResult] = useState<ContentUpdateCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set())
  const [isApplyingAll, setIsApplyingAll] = useState(false)

  const handleCheck = async () => {
    setIsChecking(true)
    try {
      const result = await api.checkForContentUpdates()
      if (result) {
        setCheckResult(result)
      }
    } catch {
      setCheckResult({
        updates: [],
        checked_at: new Date().toISOString(),
        error: t('manual.check_failed'),
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleApply = async (update: ResourceUpdateInfo) => {
    setApplyingIds((prev) => new Set(prev).add(update.resource_id))
    try {
      const result = await api.applyContentUpdate(update)
      if (result?.success) {
        addNotification({ type: 'success', message: t('manual.started_single', { id: update.resource_id }) })
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => u.resource_id !== update.resource_id) }
            : prev
        )
        queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
      } else {
        addNotification({ type: 'error', message: result?.error || t('manual.apply_failed') })
      }
    } catch {
      addNotification({ type: 'error', message: t('manual.started_single', { id: update.resource_id }) })
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev)
        next.delete(update.resource_id)
        return next
      })
    }
  }

  const handleApplyAll = async () => {
    if (!checkResult?.updates.length) return
    setIsApplyingAll(true)
    try {
      const result = await api.applyAllContentUpdates(checkResult.updates)
      if (result?.results) {
        const succeeded = result.results.filter((r) => r.success).length
        const failed = result.results.filter((r) => !r.success).length
        if (succeeded > 0) {
          addNotification({ type: 'success', message: t('manual.started_multi', { count: succeeded }) })
        }
        if (failed > 0) {
          addNotification({ type: 'error', message: t('manual.failed_multi', { count: failed }) })
        }
        const successIds = new Set(result.results.filter((r) => r.success).map((r) => r.resource_id))
        setCheckResult((prev) =>
          prev
            ? { ...prev, updates: prev.updates.filter((u) => !successIds.has(u.resource_id)) }
            : prev
        )
        if (successIds.size > 0) {
          queryClient.invalidateQueries({ queryKey: ['download-jobs'] })
        }
      }
    } catch {
      addNotification({ type: 'error', message: t('manual.apply_failed') })
    } finally {
      setIsApplyingAll(false)
    }
  }

  return (
    <div className="mt-8">
      <StyledSectionHeader title={t('manual.title')} />

      <div className="bg-surface-primary rounded-lg border shadow-md overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <p className="text-desert-stone-dark">
            {t('manual.desc')}
          </p>
          <StyledButton
            variant="primary"
            icon="IconRefresh"
            onClick={handleCheck}
            loading={isChecking}
          >
            {t('manual.check_button')}
          </StyledButton>
        </div>

        {checkResult?.error && (
          <Alert
            type="warning"
            title={t('manual.issue_title')}
            message={checkResult.error}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && !checkResult.error && checkResult.updates.length === 0 && (
          <Alert
            type="success"
            title={t('manual.all_content_up_to_date_title')}
            message={t('manual.all_content_up_to_date_msg')}
            variant="bordered"
            className="my-4"
          />
        )}

        {checkResult && checkResult.updates.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-desert-stone-dark">
                {t('manual.updates_count', { count: checkResult.updates.length })}
              </p>
              <StyledButton
                variant="primary"
                size="sm"
                icon="IconDownload"
                onClick={handleApplyAll}
                loading={isApplyingAll}
              >
                {t('manual.update_all', { count: checkResult.updates.length })}
              </StyledButton>
            </div>
            <StyledTable
              data={checkResult.updates}
              columns={[
                {
                  accessor: 'resource_id',
                  title: t('manual.th_title'),
                  render: (record) => (
                    <span className="font-medium text-desert-green">{record.resource_id}</span>
                  ),
                },
                {
                  accessor: 'resource_type',
                  title: t('manual.th_type'),
                  render: (record) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${record.resource_type === 'zim'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                        }`}
                    >
                      {record.resource_type === 'zim' ? t('manual.type_zim') : t('manual.type_map')}
                    </span>
                  ),
                },
                {
                  accessor: 'size_bytes',
                  title: t('manual.th_size'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.size_bytes ? formatBytes(record.size_bytes, 1) : '—'}
                    </span>
                  ),
                },
                {
                  accessor: 'installed_version',
                  title: t('manual.th_version'),
                  render: (record) => (
                    <span className="text-desert-stone-dark">
                      {record.installed_version} → {record.latest_version}
                    </span>
                  ),
                },
                {
                  accessor: 'resource_id',
                  title: '',
                  render: (record) => (
                    <StyledButton
                      variant="secondary"
                      size="sm"
                      icon="IconDownload"
                      onClick={() => handleApply(record)}
                      loading={applyingIds.has(record.resource_id)}
                    >
                      {t('manual.update_btn')}
                    </StyledButton>
                  ),
                },
              ]}
            />
          </div>
        )}

        {checkResult?.checked_at && (
          <p className="text-xs text-desert-stone mt-3">
            {t('manual.last_checked', { date: new Date(checkResult.checked_at).toLocaleString() })}
          </p>
        )}
      </div>

      <ActiveDownloads withHeader />
    </div>
  )
}
