import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '~/lib/util'
import type { CreatorPackWithStatus } from '../../types/collections'
import classNames from 'classnames'
import {
  IconChevronRight,
  IconCircleCheck,
  IconLoader2,
  IconMovie,
  IconTrash,
} from '@tabler/icons-react'

export interface CreatorPackCardProps {
  pack: CreatorPackWithStatus
  /** In-session wizard selection highlight (before anything is installed). */
  selected?: boolean
  onClick?: (pack: CreatorPackWithStatus) => void
  /** When set, an installed pack shows an uninstall control (settings surface only). */
  onUninstall?: (pack: CreatorPackWithStatus) => void
}

const CreatorPackCard: React.FC<CreatorPackCardProps> = ({ pack, selected, onClick, onUninstall }) => {
  const { t } = useTranslation('supply_depot')
  const isInstalled = pack.status === 'installed'
  const isDownloading = pack.status === 'downloading'
  const hasUpdate = !!pack.available_update_version
  const sizeBytes = pack.size_mb * 1024 * 1024

  const clickable = selected || !isInstalled || hasUpdate
  const highlighted = selected || isDownloading || (isInstalled && !hasUpdate)

  const [bannerFailed, setBannerFailed] = useState(false)
  const bannerSrc = pack.banner_url || `/creator-packs/${pack.id}.webp`

  const statusBadge = selected ? (
    <span className="flex items-center text-lime-600 dark:text-lime-400 text-sm font-medium">
      <IconCircleCheck className="w-5 h-5 mr-1" />
      {t('creator_packs.selected')}
    </span>
  ) : isDownloading ? (
    <span className="flex items-center text-lime-600 dark:text-lime-400 text-sm font-medium">
      <IconLoader2 className="w-5 h-5 mr-1 animate-spin" />
      {t('creator_packs.downloading')}
    </span>
  ) : isInstalled ? (
    <span className="flex items-center text-lime-600 dark:text-lime-400 text-sm font-medium">
      <IconCircleCheck className="w-5 h-5 mr-1" />
      {t('creator_packs.installed')}
    </span>
  ) : (
    <span className="flex items-center text-text-muted text-sm font-medium">
      {t('creator_packs.install')}
      <IconChevronRight className="w-5 h-5 ml-1" />
    </span>
  )

  return (
    <div
      className={classNames(
        'flex flex-col rounded-lg overflow-hidden bg-surface-primary border shadow-sm transition-shadow',
        highlighted ? 'border-lime-400 border-2' : 'border-border-subtle',
        clickable ? 'cursor-pointer hover:shadow-lg' : 'opacity-70 cursor-not-allowed'
      )}
      onClick={() => {
        if (!clickable) return
        onClick?.(pack)
      }}
    >
      {!bannerFailed ? (
        <img
          src={bannerSrc}
          alt={pack.name}
          className="w-full block aspect-[1060/175] object-cover"
          onError={() => setBannerFailed(true)}
        />
      ) : (
        <div className="flex items-center gap-2 bg-desert-green text-white px-5 py-6">
          <IconMovie className="w-6 h-6 shrink-0" />
          <h3 className="text-lg font-semibold truncate">{pack.name}</h3>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary truncate">
            {t('creator_packs.videos_count', { count: pack.video_count })} &middot; {formatBytes(sizeBytes, 0)}
          </p>
          {hasUpdate && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-lime-500/20 text-lime-700 dark:text-lime-300">
              {t('creator_packs.update_available')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge}
          {onUninstall && isInstalled && (
            <button
              type="button"
              title={t('creator_packs.uninstall_title')}
              aria-label={t('creator_packs.uninstall_title')}
              className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onUninstall(pack)
              }}
            >
              <IconTrash className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreatorPackCard
