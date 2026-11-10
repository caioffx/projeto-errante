import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StyledModal from '../StyledModal'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { useTranslation } from 'react-i18next'

interface CollectionsManagerProps {
  onClose: () => void
}

export default function CollectionsManager({ onClose }: CollectionsManagerProps) {
  const { t } = useTranslation('chat')
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['kbCollections'],
    queryFn: () => api.getKnowledgeCollections(),
    select: (data) => data?.collections ?? [],
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['kbCollections'] })
    queryClient.invalidateQueries({ queryKey: ['storedFiles'] })
  }

  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.renameCollection(oldName, newName),
    onSuccess: (data) => {
      addNotification({ type: 'success', message: data?.message || t('collections_manager.renamed_msg') })
      setEditingName(null)
      invalidateAll()
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.message || t('collections_manager.rename_failed') })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteCollection(name),
    onSuccess: (data) => {
      addNotification({ type: 'success', message: data?.message || t('collections_manager.removed_msg') })
      setConfirmDelete(null)
      invalidateAll()
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.message || t('collections_manager.remove_failed') })
    },
  })

  return (
    <StyledModal
      open={true}
      title={t('collections_manager.modal_title')}
      onClose={onClose}
      cancelText={t('common_actions.close')}
      onCancel={onClose}
      large
    >
      <div className="text-left">
        <p className="text-sm text-text-secondary mb-4">
          {t('collections_manager.modal_desc')}
        </p>

        {isLoading && <p className="text-sm text-text-muted">{t('common_actions.loading')}</p>}
        {!isLoading && collections.length === 0 && (
          <p className="text-sm text-text-muted">
            {t('collections_manager.no_collections')}
          </p>
        )}

        <ul className="divide-y divide-border-subtle">
          {collections.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 py-3">
              {editingName === name ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm text-text-primary"
                  />
                  <StyledButton
                    variant="primary"
                    icon="IconCheck"
                    loading={renameMutation.isPending}
                    disabled={!editValue.trim() || editValue.trim() === name}
                    onClick={() =>
                      renameMutation.mutate({ oldName: name, newName: editValue.trim() })
                    }
                  >
                    {t('common_actions.save')}
                  </StyledButton>
                  <StyledButton variant="outline" onClick={() => setEditingName(null)}>
                    {t('common_actions.cancel')}
                  </StyledButton>
                </>
              ) : confirmDelete === name ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    {t('collections_manager.confirm_delete_prompt', { name })}
                  </span>
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    loading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(name)}
                  >
                    {t('common_actions.confirm')}
                  </StyledButton>
                  <StyledButton variant="outline" onClick={() => setConfirmDelete(null)}>
                    {t('common_actions.cancel')}
                  </StyledButton>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-primary">{name}</span>
                  <StyledButton
                    variant="secondary"
                    icon="IconPencil"
                    onClick={() => {
                      setEditingName(name)
                      setEditValue(name)
                    }}
                  >
                    {t('common_actions.rename')}
                  </StyledButton>
                  <StyledButton
                    variant="danger"
                    icon="IconTrash"
                    onClick={() => setConfirmDelete(name)}
                  >
                    {t('common_actions.remove')}
                  </StyledButton>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </StyledModal>
  )
}
