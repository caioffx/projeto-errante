import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StyledModal from './StyledModal'
import StyledButton from './StyledButton'
import Alert from './Alert'
import api from '~/lib/api'
import Input from './inputs/Input'
import Select from './inputs/Select'
import DynamicIcon, { DynamicIconName } from './DynamicIcon'
import { IconTrash } from '@tabler/icons-react'

interface PortMapping {
  container: string
  host: string
}

interface VolumeMapping {
  host_path: string
  container_path: string
}

interface EnvVar {
  value: string
}

export interface CustomAppInitial {
  service_name: string
  friendly_name: string | null
  image: string
  category: string
  icon: string
  ports: Array<{ container: number; host: number }>
  volumes: Array<{ host_path: string; container_path: string }>
  env: string[]
  memory_mb?: number
  cpus?: number
}

interface CustomAppModalProps {
  open: boolean
  onClose: () => void
  onCreated: (serviceName: string) => void
  showError: (msg: string) => void
  mode?: 'create' | 'edit'
  initial?: CustomAppInitial | null
}

const ICON_OPTIONS = [
  { value: 'IconBrandDocker', label: 'Docker (default)' },
  { value: 'IconBox', label: 'Box' },
  { value: 'IconServer', label: 'Server' },
  { value: 'IconDatabase', label: 'Database' },
  { value: 'IconCode', label: 'Code' },
  { value: 'IconTool', label: 'Tool' },
  { value: 'IconWorld', label: 'Web' },
  { value: 'IconShieldLock', label: 'Security' },
  { value: 'IconMovie', label: 'Media' },
  { value: 'IconBook', label: 'Book' },
  { value: 'IconNotes', label: 'Notes' },
  { value: 'IconCpu', label: 'Compute' },
  { value: 'IconRobot', label: 'AI / Bot' },
  { value: 'IconWifi', label: 'Network' },
  { value: 'IconHome', label: 'Home' },
]

export default function CustomAppModal({
  open,
  onClose,
  onCreated,
  showError,
  mode = 'create',
  initial = null,
}: CustomAppModalProps) {
  const { t } = useTranslation('supply_depot')
  const isEdit = mode === 'edit'

  const categoryOptions = [
    { value: 'custom', label: t('categories.custom') },
    { value: 'productivity', label: t('categories.productivity') },
    { value: 'media', label: t('categories.media') },
    { value: 'security', label: t('categories.security') },
    { value: 'networking', label: t('categories.networking') },
    { value: 'utility', label: t('categories.utility') },
    { value: 'ai', label: t('categories.ai') },
    { value: 'education', label: t('categories.education') },
  ]

  const [friendlyName, setFriendlyName] = useState('')
  const [image, setImage] = useState('')
  const [category, setCategory] = useState('custom')
  const [icon, setIcon] = useState('IconBrandDocker')
  const [ports, setPorts] = useState<PortMapping[]>([{ container: '', host: '' }])
  const [volumes, setVolumes] = useState<VolumeMapping[]>([])
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [memoryMb, setMemoryMb] = useState('')
  const [cpus, setCpus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [portConflicts, setPortConflicts] = useState<Array<{ port: number; usedBy: string }>>([])
  const [resourceWarnings, setResourceWarnings] = useState<string[]>([])
  const [blocked, setBlocked] = useState<string[]>([])
  const [forceInstall, setForceInstall] = useState(false)
  const [checkingPreflight, setCheckingPreflight] = useState(false)
  const [suggestedPort, setSuggestedPort] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    if (isEdit && initial) {
      setFriendlyName(initial.friendly_name ?? '')
      setImage(initial.image)
      setCategory(initial.category)
      setIcon(initial.icon || 'IconBrandDocker')
      setPorts(
        initial.ports.length
          ? initial.ports.map((p) => ({ container: String(p.container), host: String(p.host) }))
          : [{ container: '', host: '' }]
      )
      setVolumes(initial.volumes)
      setEnvVars(initial.env.map((v) => ({ value: v })))
      setMemoryMb(initial.memory_mb != null ? String(initial.memory_mb) : '')
      setCpus(initial.cpus != null ? String(initial.cpus) : '')
      return
    }
    api.suggestCustomPort().then((res) => {
      if (res?.port) {
        setSuggestedPort(res.port)
        setPorts([{ container: '', host: String(res.port) }])
      }
    })
  }, [open, isEdit, initial])

  useEffect(() => {
    if (!open) return
    const validPorts = ports
      .map((p) => parseInt(p.host, 10))
      .filter((p) => !isNaN(p))
    const validVolumes = volumes.filter((v) => v.host_path && v.container_path)

    if (validPorts.length === 0 && validVolumes.length === 0 && !image.trim()) {
      setPortConflicts([])
      setResourceWarnings([])
      setBlocked([])
      setCheckingPreflight(false)
      return
    }

    setCheckingPreflight(true)
    const handle = setTimeout(async () => {
      const res = await api.preflightCustomApp({
        image: image.trim() || undefined,
        ports: validPorts.length ? validPorts : undefined,
        volumes: validVolumes.length ? validVolumes : undefined,
        exclude_service: isEdit && initial ? initial.service_name : undefined,
      })
      if (res) {
        setPortConflicts(res.portConflicts ?? [])
        setResourceWarnings(res.resourceWarnings ?? [])
        setBlocked(res.blocked ?? [])
      }
      setCheckingPreflight(false)
    }, 400)

    return () => clearTimeout(handle)
  }, [open, ports, volumes, image])

  function resetForm() {
    setFriendlyName('')
    setImage('')
    setCategory('custom')
    setIcon('IconBrandDocker')
    setPorts([{ container: '', host: '' }])
    setVolumes([])
    setEnvVars([])
    setMemoryMb('')
    setCpus('')
    setPortConflicts([])
    setResourceWarnings([])
    setBlocked([])
    setForceInstall(false)
    setSuggestedPort(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function updatePort(idx: number, field: keyof PortMapping, value: string) {
    setPorts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }
  function addPort() {
    const nextHost = suggestedPort ? suggestedPort + ports.length * 10 : 8600 + ports.length * 10
    setPorts((prev) => [...prev, { container: '', host: String(nextHost) }])
  }
  function removePort(idx: number) {
    setPorts((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateVolume(idx: number, field: keyof VolumeMapping, value: string) {
    setVolumes((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)))
  }
  function addVolume() {
    setVolumes((prev) => [...prev, { host_path: '', container_path: '' }])
  }
  function removeVolume(idx: number) {
    setVolumes((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateEnv(idx: number, value: string) {
    setEnvVars((prev) => prev.map((e, i) => (i === idx ? { value } : e)))
  }
  function addEnv() {
    setEnvVars((prev) => [...prev, { value: '' }])
  }
  function removeEnv(idx: number) {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!friendlyName.trim() || !image.trim()) {
      showError(t('custom_app.err_name_image_required'))
      return
    }
    if (blocked.length > 0) {
      showError(t('custom_app.err_resolve_blocks'))
      return
    }

    const validPorts = ports
      .filter((p) => p.container && p.host)
      .map((p) => ({ container: parseInt(p.container, 10), host: parseInt(p.host, 10) }))
      .filter((p) => !isNaN(p.container) && !isNaN(p.host))

    const validVolumes = volumes.filter((v) => v.host_path && v.container_path)
    const validEnv = envVars.map((e) => e.value).filter(Boolean)
    const parsedMemory = parseInt(memoryMb, 10)
    const parsedCpus = parseFloat(cpus)

    setSubmitting(true)
    try {
      const common = {
        friendly_name: friendlyName.trim(),
        image: image.trim(),
        ports: validPorts.length ? validPorts : undefined,
        volumes: validVolumes.length ? validVolumes : undefined,
        env: validEnv.length ? validEnv : undefined,
        category,
        icon,
        memory_mb: !isNaN(parsedMemory) ? parsedMemory : undefined,
        cpus: !isNaN(parsedCpus) ? parsedCpus : undefined,
        force: forceInstall,
      }
      const result =
        isEdit && initial
          ? await api.updateCustomApp({ service_name: initial.service_name, ...common })
          : await api.createCustomApp(common)

      if (result?.success && result.service_name) {
        resetForm()
        onCreated(result.service_name)
      } else {
        if (result?.message?.toLowerCase().includes('port') || result?.message?.toLowerCase().includes('conflict')) {
          showError(result.message)
        } else {
          showError(result?.message || 'Failed to create custom app.')
        }
      }
    } catch (err: any) {
      showError(err?.message || 'Unexpected error creating custom app.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasWarnings = portConflicts.length > 0 || resourceWarnings.length > 0
  const hasBlocks = blocked.length > 0
  const canSubmit =
    friendlyName.trim() && image.trim() && !hasBlocks && (!hasWarnings || forceInstall)

  return (
    <StyledModal
      title={isEdit ? t('custom_app.modal_edit_title') : t('custom_app.modal_create_title')}
      open={open}
      onCancel={handleClose}
      cancelText={t('common:buttons.cancel', { defaultValue: 'Cancel' })}
      onConfirm={handleSubmit}
      confirmVariant='primary'
      confirmText={isEdit ? t('custom_app.btn_save_recreate') : t('custom_app.btn_install')}
      confirmIcon="IconBrandDocker"
      confirmLoading={submitting}
      confirmDisabled={!canSubmit}
      large
    >
      <div className="space-y-6 text-sm">
        {/* Image + Name */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            name='image'
            label={t('custom_app.field_docker_image')}
            placeholder={t('custom_app.field_docker_image_ph')}
            value={image}
            onChange={(e) => setImage(e.target.value)}
            required
          />
          <Input
            name='friendlyName'
            label={t('custom_app.field_display_name')}
            placeholder={t('custom_app.field_display_name_ph')}
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            required
          />
        </div>

        {/* Category + Icon */}
        <div className="grid grid-cols-2 gap-4 items-start">
          <Select
            name='category'
            label={t('custom_app.field_category')}
            helpText={t('custom_app.field_category_help')}
            value={category}
            onChange={(newVal) => setCategory(newVal)}
            options={categoryOptions}
          />
          <div className="flex items-end gap-2">
            <Select
              name='icon'
              label={t('custom_app.field_icon')}
              helpText={t('custom_app.field_icon_help')}
              value={icon}
              onChange={(newVal) => setIcon(newVal)}
              options={ICON_OPTIONS}
              className="flex-1 min-w-0"
            />
            <div
              className="flex-shrink-0 flex items-center justify-center h-[42px] w-[42px] rounded-md border border-border-default bg-surface-secondary"
              title={t('custom_app.icon_preview')}
            >
              <DynamicIcon icon={icon as DynamicIconName} className="h-6 w-6 text-desert-green" />
            </div>
          </div>
        </div>

        {/* Port Mappings */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('custom_app.ports_label')}</label>
            <StyledButton size="sm" variant="ghost" icon="IconPlus" onClick={addPort}>
              {t('custom_app.btn_add_port')}
            </StyledButton>
          </div>
          {ports.length === 0 && (
            <p className="text-xs italic">{t('custom_app.no_ports')}</p>
          )}
          <div className="space-y-2">
            {ports.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 w-full">
                <Input
                  name={`containerPort${idx}`}
                  label=''
                  type="number"
                  placeholder={t('custom_app.ph_container_port')}
                  value={p.container}
                  onChange={(e) => updatePort(idx, 'container', e.target.value)}
                  className='w-full'
                />
                <span className="text-xs">→</span>
                <Input
                  name={`hostPort${idx}`}
                  label=''
                  type="number"
                  placeholder={t('custom_app.ph_host_port')}
                  value={p.host}
                  onChange={(e) => updatePort(idx, 'host', e.target.value)}
                  className='w-full'
                />
                <button
                  type="button"
                  onClick={() => removePort(idx)}
                  className="hover:text-desert-red transition-colors cursor-pointer"
                >
                  <IconTrash className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs mt-2">{t('custom_app.ports_range_note', { port: suggestedPort ?? 8600 })}</p>
          {checkingPreflight && (
            <p className="text-xs mt-1 italic text-text-muted">{t('custom_app.checking_port_availability')}</p>
          )}
        </div>

        {/* Volume Mappings */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('custom_app.volumes_label')}</label>
            <StyledButton size="sm" variant="ghost" icon="IconPlus" onClick={addVolume}>
              {t('custom_app.btn_add_volume')}
            </StyledButton>
          </div>
          {volumes.length === 0 && (
            <p className="text-xs italic">{t('custom_app.no_volumes')}</p>
          )}
          <div className="space-y-2">
            {volumes.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  name={`hostPath${idx}`}
                  label=''
                  type="text"
                  placeholder={t('custom_app.ph_host_path')}
                  value={v.host_path}
                  onChange={(e) => updateVolume(idx, 'host_path', e.target.value)}
                  className='w-full'
                />
                <span className="text-xs">:</span>
                <Input
                  name={`containerPath${idx}`}
                  label=''
                  type="text"
                  placeholder={t('custom_app.ph_container_path')}
                  value={v.container_path}
                  onChange={(e) => updateVolume(idx, 'container_path', e.target.value)}
                  className='w-full'
                />
                <button
                  type="button"
                  onClick={() => removeVolume(idx)}
                  className="hover:text-desert-red transition-colors cursor-pointer"
                >
                  <IconTrash className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Environment Variables */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t('custom_app.env_vars_label')}</label>
            <StyledButton size="sm" variant="ghost" icon="IconPlus" onClick={addEnv}>
              {t('custom_app.btn_add_var')}
            </StyledButton>
          </div>
          <div className="space-y-2">
            {envVars.map((e, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  name={`envVar${idx}`}
                  label=''
                  placeholder={t('custom_app.ph_env_var')}
                  value={e.value}
                  onChange={(ev) => updateEnv(idx, ev.target.value)}
                  className='w-full font-mono'
                />
                <button
                  type="button"
                  onClick={() => removeEnv(idx)}
                  className="hover:text-desert-red transition-colors cursor-pointer"
                >
                  <IconTrash className="w-5 h-5" />
                </button>
              </div>
            ))}
            {envVars.length === 0 && (
              <p className="text-xs italic">{t('custom_app.no_env_vars')}</p>
            )}
          </div>
        </div>

        {/* Advanced: resource limits */}
        <div>
          <label className="text-sm font-medium">{t('custom_app.resource_limits_label')}</label>
          <div className="grid grid-cols-2 gap-4 mt-1">
            <Input
              name='memoryMb'
              label=''
              type="number"
              placeholder={t('custom_app.ph_memory')}
              value={memoryMb}
              onChange={(e) => setMemoryMb(e.target.value)}
              className='w-full'
            />
            <Input
              name='cpus'
              label=''
              type="number"
              placeholder={t('custom_app.ph_cpus')}
              value={cpus}
              onChange={(e) => setCpus(e.target.value)}
              className='w-full'
            />
          </div>
          <p className="text-xs mt-1 italic">{t('custom_app.resource_limits_help')}</p>
        </div>

        {/* Hard blocks */}
        {hasBlocks && (
          <div className="space-y-2">
            {blocked.map((b, i) => (
              <Alert key={i} type="error" title={t('custom_app.block_not_allowed')} message={b} />
            ))}
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-2">
            {portConflicts.map((c) => (
              <Alert
                key={c.port}
                type="warning"
                title={t('custom_app.port_in_use_title', { port: c.port })}
                message={t('custom_app.port_in_use_msg', { usedBy: c.usedBy })}
              />
            ))}
            {resourceWarnings.map((w, i) => (
              <Alert key={i} type="warning" title={t('modals.resource_warning_title')} message={w} />
            ))}
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={forceInstall}
                onChange={(e) => setForceInstall(e.target.checked)}
                className="accent-desert-orange h-4 w-4 rounded"
              />
              <span className="text-text-muted text-xs">{t('custom_app.install_anyway_checkbox')}</span>
            </label>
          </div>
        )}

        <p className="text-sm">
          {t('custom_app.restart_policy_note')}
        </p>
      </div>
    </StyledModal>
  )
}
