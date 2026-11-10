import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconMovie } from '@tabler/icons-react'
import api from '~/lib/api'
import useCreatorPacks from '~/hooks/useCreatorPacks'
import useDownloads from '~/hooks/useDownloads'
import { useNotifications } from '~/context/NotificationContext'
import CreatorPackCard from '~/components/CreatorPackCard'
import StyledModal from '~/components/StyledModal'
import { formatBytes } from '~/lib/util'
import type { CreatorPackWithStatus } from '../../types/collections'

const LICENSE_URL =
  'https://github.com/Crosstalk-Solutions/project-nomad/blob/main/collections/creator-pack-license.md'

export interface CreatorPacksSectionProps {
  allowUninstall?: boolean
}

const CreatorPacksSection: React.FC<CreatorPacksSectionProps> = ({ allowUninstall }) => {
  const { t } = useTranslation('supply_depot')
  const { configured, packs, invalidate: invalidateCreatorPacks } = useCreatorPacks()
  const { invalidate: invalidateDownloads } = useDownloads({ filetype: 'zim' })
  const { addNotification } = useNotifications()

  const [packToInstall, setPackToInstall] = useState<CreatorPackWithStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [packToUninstall, setPackToUninstall] = useState<CreatorPackWithStatus | null>(null)
  const [uninstalling, setUninstalling] = useState(false)

  if (!configured) return null

  const handleConfirmInstall = async () => {
    if (!packToInstall) return
    setInstalling(true)
    try {
      await api.installCreatorPack(packToInstall.id)
      addNotification({ message: t('creator_packs.started_installing', { name: packToInstall.name }), type: 'success' })
      invalidateCreatorPacks()
      invalidateDownloads()
      setPackToInstall(null)
    } catch (error) {
      console.error('Error installing creator pack:', error)
      addNotification({ message: t('creator_packs.install_error'), type: 'error' })
    } finally {
      setInstalling(false)
    }
  }

  const handleConfirmUninstall = async () => {
    if (!packToUninstall) return
    setUninstalling(true)
    try {
      await api.uninstallCreatorPack(packToUninstall.id)
      addNotification({ message: t('creator_packs.uninstalled_success', { name: packToUninstall.name }), type: 'success' })
      invalidateCreatorPacks()
      invalidateDownloads()
      setPackToUninstall(null)
    } catch (error) {
      console.error('Error uninstalling creator pack:', error)
      addNotification({ message: t('creator_packs.uninstall_error'), type: 'error' })
    } finally {
      setUninstalling(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mt-8 mb-4">
        <div className="w-10 h-10 rounded-full bg-surface-primary border border-border-subtle flex items-center justify-center shadow-sm">
          <IconMovie className="w-6 h-6 text-text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-text-primary">{t('creator_packs.title')}</h3>
          <p className="text-sm text-text-muted">
            {t('creator_packs.subtitle')}
          </p>
        </div>
      </div>

      {packs.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {packs.map((pack) => (
            <CreatorPackCard
              key={pack.id}
              pack={pack}
              onClick={setPackToInstall}
              onUninstall={allowUninstall ? setPackToUninstall : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-muted mt-4">{t('creator_packs.empty')}</p>
      )}

      <StyledModal
        open={!!packToInstall}
        title={packToInstall ? t('creator_packs.install_modal_title', { name: packToInstall.name }) : t('creator_packs.install_modal_title_default')}
        onClose={() => !installing && setPackToInstall(null)}
        onCancel={() => setPackToInstall(null)}
        onConfirm={handleConfirmInstall}
        confirmText={packToInstall?.available_update_version ? t('creator_packs.update_pack_btn') : t('creator_packs.install_pack_btn')}
        confirmIcon="IconDownload"
        confirmLoading={installing}
        icon={<IconMovie className="w-6 h-6" />}
      >
        {packToInstall && (
          <div className="space-y-3 text-text-secondary">
            <p>
              {t('creator_packs.install_modal_desc', {
                count: packToInstall.video_count,
                creator: packToInstall.creator,
                size: formatBytes(packToInstall.size_mb * 1024 * 1024, 0),
              })}
            </p>
            <p className="text-sm text-text-muted">
              {t('creator_packs.licensed_notice')}{' '}
              <a
                href={LICENSE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-desert-green underline hover:no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                {t('creator_packs.view_license')}
              </a>
            </p>
          </div>
        )}
      </StyledModal>

      <StyledModal
        open={!!packToUninstall}
        title={packToUninstall ? t('creator_packs.uninstall_modal_title', { name: packToUninstall.name }) : t('creator_packs.uninstall_modal_title_default')}
        onClose={() => !uninstalling && setPackToUninstall(null)}
        onCancel={() => setPackToUninstall(null)}
        onConfirm={handleConfirmUninstall}
        confirmText={t('creator_packs.uninstall_pack_btn')}
        confirmIcon="IconTrash"
        confirmVariant="danger"
        confirmLoading={uninstalling}
        icon={<IconMovie className="w-6 h-6" />}
      >
        {packToUninstall && (
          <p className="text-text-secondary">
            {t('creator_packs.uninstall_modal_desc', {
              size: formatBytes(packToUninstall.size_mb * 1024 * 1024, 0),
            })}
          </p>
        )}
      </StyledModal>
    </>
  )
}

export default CreatorPacksSection
