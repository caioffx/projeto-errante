import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ChatSidebar from './ChatSidebar'
import ChatInterface from './ChatInterface'
import KbPolicyPromptBanner from './KbPolicyPromptBanner'
import StyledModal from '../StyledModal'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import { useModals } from '~/context/ModalContext'
import { ChatMessage } from '../../../types/chat'
import classNames from '~/lib/classNames'
import { IconMenu2, IconX } from '@tabler/icons-react'
import { DEFAULT_QUERY_REWRITE_MODEL } from '../../../constants/ollama'
import { useSystemSetting } from '~/hooks/useSystemSetting'
import Switch from '~/components/inputs/Switch'
import InfoTooltip from '~/components/InfoTooltip'
import { useTranslation } from 'react-i18next'

interface ChatProps {
  enabled: boolean
  isInModal?: boolean
  onClose?: () => void
  suggestionsEnabled?: boolean
  streamingEnabled?: boolean
}

export default function Chat({
  enabled,
  isInModal,
  onClose,
  suggestionsEnabled = false,
  streamingEnabled = true,
}: ChatProps) {
  const { t } = useTranslation('chat')
  const queryClient = useQueryClient()
  const { openModal, closeAllModals } = useModals()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [collectionFilter, setCollectionFilter] = useState<string>('')
  const [pendingModelSwitch, setPendingModelSwitch] = useState<string | null>(null)
  const pageLoadNormalizedRef = useRef(false)
  const [isStreamingResponse, setIsStreamingResponse] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const streamAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isMobileSidebarOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMobileSidebarOpen])

  // Fetch all sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: () => api.getChatSessions(),
    enabled,
    select: (data) =>
      data?.map((s) => ({
        id: s.id,
        title: s.title,
        model: s.model || undefined,
        timestamp: new Date(s.timestamp),
        lastMessage: s.lastMessage || undefined,
      })) || [],
  })

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const { data: lastModelSetting } = useSystemSetting({ key: 'chat.lastModel', enabled })
  const { data: remoteOllamaUrlSetting } = useSystemSetting({ key: 'ai.remoteOllamaUrl', enabled })
  const { data: autoThinkingSetting } = useSystemSetting({ key: 'ai.autoThinking', enabled })
  const autoThinkingDefault =
    autoThinkingSetting?.value === true || autoThinkingSetting?.value === 'true'

  const { data: remoteStatus } = useQuery({
    queryKey: ['remoteOllamaStatus'],
    queryFn: () => api.getRemoteOllamaStatus(),
    enabled: enabled && !!remoteOllamaUrlSetting?.value,
    refetchInterval: 15000,
  })

  const { data: installedModels = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['installedModels'],
    queryFn: () => api.getInstalledModels(),
    enabled,
    select: (data) => data || [],
  })

  const { data: knownCollections = [] } = useQuery({
    queryKey: ['kbCollections'],
    queryFn: () => api.getKnowledgeCollections(),
    select: (data) => data?.collections ?? [],
  })

  const [thinkingOverrides, setThinkingOverrides] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const next: Record<string, boolean> = {}
    for (const m of installedModels) {
      try {
        const stored = localStorage.getItem(`nomad:thinking:${m.name}`)
        if (stored !== null) next[m.name] = stored === 'true'
      } catch {}
    }
    setThinkingOverrides(next)
  }, [installedModels])

  const selectedModelSupportsThinking =
    installedModels.find((m) => m.name === selectedModel)?.thinking === true

  const effectiveThinking = useCallback(
    (model: string): boolean =>
      model in thinkingOverrides ? thinkingOverrides[model] : autoThinkingDefault,
    [thinkingOverrides, autoThinkingDefault]
  )

  const setModelThinking = useCallback((model: string, value: boolean) => {
    setThinkingOverrides((prev) => ({ ...prev, [model]: value }))
    try {
      localStorage.setItem(`nomad:thinking:${model}`, String(value))
    } catch {}
  }, [])

  const { data: chatSuggestions, isLoading: chatSuggestionsLoading } = useQuery<string[]>({
    queryKey: ['chatSuggestions'],
    queryFn: async ({ signal }) => {
      const res = await api.getChatSuggestions(signal)
      return res ?? []
    },
    enabled: suggestionsEnabled && !activeSessionId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const rewriteModelAvailable = useMemo(() => {
    return installedModels.some((model) => model.name === DEFAULT_QUERY_REWRITE_MODEL)
  }, [installedModels])

  const deleteAllSessionsMutation = useMutation({
    mutationFn: () => api.deleteAllChatSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] })
      setActiveSessionId(null)
      setMessages([])
    },
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => api.deleteChatSession(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] })
      if (activeSessionId === deletedId) {
        setActiveSessionId(null)
        setMessages([])
      }
    },
  })

  const handleClearHistory = () => {
    openModal(
      <StyledModal
        open={true}
        title={t('chat_main.clear_history_title')}
        onClose={closeAllModals}
        confirmText={t('common_actions.clear')}
        confirmVariant="danger"
        onConfirm={() => {
          deleteAllSessionsMutation.mutate()
          closeAllModals()
        }}
        cancelText={t('common_actions.cancel')}
        onCancel={closeAllModals}
      >
        <p className="text-text-primary">
          {t('chat_main.clear_history_confirm')}
        </p>
      </StyledModal>,
      'clear-chat-history-modal'
    )
  }

  // Model switch confirmation modal
  const handleModelSelectChange = (newModel: string) => {
    if (messages.length > 0 && newModel !== selectedModel) {
      setPendingModelSwitch(newModel)
    } else {
      setSelectedModel(newModel)
      api.updateSetting('chat.lastModel', newModel)
    }
  }

  const confirmModelSwitch = () => {
    if (pendingModelSwitch) {
      setSelectedModel(pendingModelSwitch)
      api.updateSetting('chat.lastModel', pendingModelSwitch)
      setActiveSessionId(null)
      setMessages([])
      setPendingModelSwitch(null)
    }
  }

  // Load messages when session changes
  useEffect(() => {
    if (activeSessionId) {
      api.getChatSessionMessages(activeSessionId).then((loadedMessages) => {
        setMessages(
          loadedMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
        )
      })
    } else {
      setMessages([])
    }
  }, [activeSessionId])

  // Set default model when models load
  useEffect(() => {
    if (installedModels.length > 0 && !selectedModel) {
      const preferredModel = lastModelSetting?.value || installedModels[0]?.name
      const modelExists = installedModels.some((m) => m.name === preferredModel)
      setSelectedModel(modelExists ? preferredModel : installedModels[0].name)
    }
  }, [installedModels, lastModelSetting, selectedModel])

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsStreamingResponse(true)

    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages((prev) => [...prev, assistantMessage])

    try {
      const abortController = new AbortController()
      streamAbortRef.current = abortController

      const thinking = effectiveThinking(selectedModel)

      await api.streamChat(
        {
          message: content,
          model: selectedModel,
          sessionId: activeSessionId || undefined,
          collection: collectionFilter || undefined,
          thinking,
        },
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: msg.content + (chunk.content || ''),
                    thinking: chunk.thinking !== undefined ? (msg.thinking || '') + chunk.thinking : msg.thinking,
                    isThinking: chunk.isThinking !== undefined ? chunk.isThinking : msg.isThinking,
                    thinkingDuration: chunk.thinkingDuration !== undefined ? chunk.thinkingDuration : msg.thinkingDuration,
                  }
                : msg
            )
          )

          if (chunk.sessionId && !activeSessionId) {
            setActiveSessionId(chunk.sessionId)
            queryClient.invalidateQueries({ queryKey: ['chatSessions'] })
          }
        },
        abortController.signal
      )
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || t('chat_main.stream_failed_error'),
                }
              : msg
          )
        )
      }
    } finally {
      setIsStreamingResponse(false)
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
      )
      streamAbortRef.current = null
    }
  }

  return (
    <div className="flex h-full w-full relative">
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={(id) => {
          setActiveSessionId(id)
          setIsMobileSidebarOpen(false)
        }}
        onNewChat={() => {
          setActiveSessionId(null)
          setMessages([])
          setIsMobileSidebarOpen(false)
        }}
        onClearHistory={handleClearHistory}
        isInModal={isInModal}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main chat view */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <KbPolicyPromptBanner />

        {/* Header bar */}
        <div className="h-[75px] border-b border-border-subtle bg-surface-primary px-4 md:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-2 -ml-2 text-text-muted hover:text-text-primary md:hidden"
              aria-label={t('chat_main.toggle_sidebar')}
            >
              <IconMenu2 className="h-5 w-5" />
            </button>
            <h2 className="font-semibold text-text-primary text-base truncate">
              {activeSession ? activeSession.title : t('chat_main.new_chat_title')}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Knowledge base collection filter */}
            {knownCollections.length > 0 && (
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="text-xs rounded border border-border-subtle bg-surface-secondary px-2 py-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-desert-green"
              >
                <option value="">{t('chat_main.all_collections')}</option>
                {knownCollections.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Model selector */}
            {installedModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => handleModelSelectChange(e.target.value)}
                className="text-xs rounded border border-border-subtle bg-surface-secondary px-2 py-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-desert-green max-w-[150px] md:max-w-[200px] truncate"
              >
                {installedModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            {/* Thinking toggle for models that support it */}
            {selectedModelSupportsThinking && (
              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-border-subtle">
                <span className="text-xs text-text-muted">{t('chat_main.thinking_toggle')}</span>
                <Switch
                  checked={effectiveThinking(selectedModel)}
                  onChange={(val) => setModelThinking(selectedModel, val)}
                />
              </div>
            )}

            {isInModal && onClose && (
              <button
                onClick={onClose}
                className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors ml-2"
                aria-label={t('common_actions.close')}
              >
                <IconX className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat message thread */}
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isStreamingResponse}
          chatSuggestions={chatSuggestions}
          chatSuggestionsEnabled={suggestionsEnabled}
          chatSuggestionsLoading={chatSuggestionsLoading}
          rewriteModelAvailable={rewriteModelAvailable}
        />
      </div>

      {/* Model switch modal */}
      {pendingModelSwitch && (
        <StyledModal
          open={true}
          title={t('chat_main.switch_model_title', { model: pendingModelSwitch })}
          onClose={() => setPendingModelSwitch(null)}
          confirmText={t('chat_main.switch_model_btn')}
          onConfirm={confirmModelSwitch}
          cancelText={t('common_actions.cancel')}
          onCancel={() => setPendingModelSwitch(null)}
        >
          <p className="text-text-primary">
            {t('chat_main.switch_model_desc')}
          </p>
        </StyledModal>
      )}
    </div>
  )
}
