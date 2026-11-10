import { useEffect, useRef, useState } from 'react'
import { IconChartBar, IconCpu, IconDatabase, IconRobot, IconServer } from '@tabler/icons-react'
import CircularGauge from '~/components/systeminfo/CircularGauge'
import StyledButton from '~/components/StyledButton'
import { getScoreDisplay } from '~/lib/benchmarkScore'
import BenchmarkResult from '#models/benchmark_result'
import { useTranslation } from 'react-i18next'

interface ScoreRevealProps {
  result: BenchmarkResult
  scoreScale?: { max: number; caption: string }
  onDone: () => void
}

// Same thresholds as the NOMAD Score section on the benchmark page.
const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

// AI tokens/sec normalized to 0-100 (30 tok/s = 50, 60 tok/s = 100),
// mirroring the benchmark page's getAIScore.
const getAIScore = (tokensPerSecond: number): number =>
  Math.min(100, Math.max(0, (tokensPerSecond / 60) * 100))

/** rAF count-up from 0 to `target` with ease-out, for the big score number. */
function useCountUp(target: number, durationMs = 1200): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

/**
 * End-of-run score reveal. Replaces the abrupt unmount of the live run view
 * with a deliberate report: big NOMAD score gauge + count-up number, then the
 * sub-score gauges cascading in. Dismisses via the Continue button or an
 * auto-dismiss timer.
 */
export default function ScoreReveal({
  result,
  scoreScale = { max: 100, caption: 'out of 100' },
  onDone,
}: ScoreRevealProps) {
  const { t } = useTranslation('benchmark')
  const displayScore = useCountUp(result.nomad_score)
  // A partial (System/AI Only) run is not the NOMAD Score -- relabel + flag it.
  const scoreInfo = getScoreDisplay(result.benchmark_type)

  // Sub-score gauges, mirroring the System Performance / AI Performance grids.
  const gauges: {
    label: string
    value: number
    variant: 'cpu' | 'memory' | 'disk'
    icon: React.ReactNode
  }[] = [
    { label: t('score_reveal.cpu'), value: result.cpu_score * 100, variant: 'cpu', icon: <IconCpu className="w-6 h-6" /> },
    { label: t('score_reveal.memory'), value: result.memory_score * 100, variant: 'memory', icon: <IconDatabase className="w-6 h-6" /> },
    { label: t('score_reveal.disk_read'), value: result.disk_read_score * 100, variant: 'disk', icon: <IconServer className="w-6 h-6" /> },
    { label: t('score_reveal.disk_write'), value: result.disk_write_score * 100, variant: 'disk', icon: <IconServer className="w-6 h-6" /> },
  ]
  if (result.ai_tokens_per_second) {
    gauges.push({
      label: t('score_reveal.ai_score'),
      value: getAIScore(result.ai_tokens_per_second),
      variant: 'cpu',
      icon: <IconRobot className="w-6 h-6" />,
    })
  }

  // Cascade: mount one gauge every 150ms; each CircularGauge animates 0→value
  // on mount, so staggered mounts produce the cascade.
  const [visibleCount, setVisibleCount] = useState(0)
  useEffect(() => {
    if (visibleCount >= gauges.length) return
    const id = setTimeout(() => setVisibleCount((n) => n + 1), 150)
    return () => clearTimeout(id)
  }, [visibleCount, gauges.length])

  // Dismiss exactly once, whether via the button or the auto-dismiss timer.
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const fireDone = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }
  useEffect(() => {
    const id = setTimeout(fireDone, 5000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      role="region"
      aria-label={t('score_reveal.benchmark_complete')}
      className="bg-desert-white rounded-lg p-8 border border-desert-stone-light shadow-sm space-y-8 animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-desert-stone-light pb-6">
        <div>
          <div className="text-xs font-semibold text-desert-green uppercase tracking-wide">
            {t('score_reveal.benchmark_complete')}
          </div>
          <h2 className="text-2xl font-bold text-desert-stone-dark mt-1">
            {t('score_reveal.your_score', { label: scoreInfo.label })}
          </h2>
        </div>
        <StyledButton variant="primary" onClick={fireDone}>
          {t('score_reveal.continue_btn')}
        </StyledButton>
      </div>

      {/* Main score hero */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
        <div className="relative">
          <CircularGauge
            value={displayScore}
            max={scoreScale.max}
            size={180}
            strokeWidth={14}
            variant="score"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className={`font-mono font-bold text-5xl tabular-nums leading-none ${getScoreColor(result.nomad_score)}`}
            >
              {Math.round(displayScore)}
            </span>
            <span className="text-xs text-desert-stone-dark/80 mt-1">{scoreScale.caption}</span>
          </div>
        </div>

        <div className="max-w-md text-center md:text-left space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <IconChartBar className="w-5 h-5 text-desert-green" />
            <span className="font-semibold text-desert-stone-dark">{scoreInfo.label}</span>
          </div>
          <p className="text-sm text-desert-stone-dark">
            {t('score_reveal.score_summary', {
              cpu: Math.round(result.cpu_score * 100),
              mem: Math.round(result.memory_score * 100),
              read: Math.round(result.disk_read_score * 100),
              write: Math.round(result.disk_write_score * 100)
            })}
          </p>
          {result.ai_tokens_per_second !== null && (
            <p className="text-sm text-desert-stone-dark font-mono">
              {t('score_reveal.ai_tok_sec', { speed: result.ai_tokens_per_second.toFixed(1) })}
            </p>
          )}
        </div>
      </div>

      {/* Sub-score grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 pt-4 border-t border-desert-stone-light">
        {gauges.map((g, i) => {
          const visible = i < visibleCount
          return (
            <div
              key={g.label}
              className={`flex flex-col items-center p-3 rounded-lg bg-desert-white border border-desert-stone-light/60 transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              <div className="w-16 h-16 relative mb-2">
                <CircularGauge
                  value={visible ? g.value : 0}
                  max={100}
                  size={64}
                  strokeWidth={6}
                  variant={g.variant}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-mono text-xs font-bold text-desert-stone-dark">
                    {visible ? Math.round(g.value) : '--'}
                  </span>
                </div>
              </div>
              <div className="text-xs font-semibold text-desert-stone-dark text-center flex items-center gap-1">
                {g.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
