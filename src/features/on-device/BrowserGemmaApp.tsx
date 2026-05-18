import { useEffect, useRef, useState } from 'react'
import type { ModelPlan } from '../../lib/analysis/adapter'
import { inspectOnDeviceCapability, logCapabilityReport } from '../../lib/on-device/capabilityCheck'
import { BrowserInferenceSession } from '../../lib/on-device/inferenceSession'
import {
  generateLocalBackupResponse,
  readLocalBackupConfig,
} from '../../lib/on-device/localBackupSession'
import {
  DEFAULT_MODEL_ASSET_PATH,
  GEMMA4_MODEL_LABEL,
  OFFICIAL_MODEL_PAGE_URL,
  OFFICIAL_WEB_MODEL_URL,
} from '../../lib/on-device/modelConfig'
import { resolveGenerationLimits } from '../../lib/on-device/promptUtils'
import type {
  CapabilityReport,
  ModelStatus,
  StatusSnapshot,
} from '../../lib/on-device/types'
import './browserGemmaApp.css'

interface BrowserGemmaAppProps {
  localModelPlan: ModelPlan
}

const INITIAL_STATUS: StatusSnapshot = {
  detail: 'Checking browser support and model availability.',
  state: 'loading',
}

async function loadCapabilityReport() {
  const report = await inspectOnDeviceCapability(DEFAULT_MODEL_ASSET_PATH)
  logCapabilityReport(report)
  return report
}

function formatStatusLabel(state: ModelStatus) {
  switch (state) {
    case 'checking-cache':
      return 'Checking saved model'
    case 'ready-to-download':
      return 'Ready to download'
    default:
      return state.charAt(0).toUpperCase() + state.slice(1)
  }
}

function getStatusTone(state: ModelStatus) {
  switch (state) {
    case 'ready':
      return 'ready'
    case 'generating':
    case 'checking-cache':
    case 'downloading':
    case 'loading':
      return 'busy'
    case 'unsupported':
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

function buildStatusDetail(
  status: StatusSnapshot,
  capabilityReport: CapabilityReport | null,
) {
  if (status.state === 'unsupported' && capabilityReport) {
    return capabilityReport.gateReasons.map((reason) => reason.detail).join(' ')
  }

  return status.detail
}

function getLocalBackupLabel(configured: boolean, isGenerating: boolean) {
  if (isGenerating) {
    return 'Generating'
  }

  return configured ? 'Ready' : 'Unavailable'
}

function getLocalBackupTone(configured: boolean, isGenerating: boolean) {
  if (isGenerating) {
    return 'busy'
  }

  return configured ? 'ready' : 'idle'
}

function describeLocalBackup(
  modelPlan: ModelPlan,
  fallbackLabel: string | null,
) {
  if (!modelPlan.liveConfigured) {
    return 'No local endpoint is configured yet. Add a local URL if you want a development image-reading path while the browser flow is still being tuned.'
  }

  return `Local Gemma endpoint: ${modelPlan.runtimeLabel} using ${modelPlan.primaryLabel}${
    fallbackLabel ? `, then ${fallbackLabel}` : ''
  }.`
}

export default function BrowserGemmaApp({
  localModelPlan,
}: BrowserGemmaAppProps) {
  const [capabilityReport, setCapabilityReport] = useState<CapabilityReport | null>(
    null,
  )
  const [status, setStatus] = useState<StatusSnapshot>(INITIAL_STATUS)
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [responseLabel, setResponseLabel] = useState<string | null>(null)
  const [lightMode, setLightMode] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [isLocalGenerating, setIsLocalGenerating] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const sessionRef = useRef<BrowserInferenceSession | null>(null)
  const disposeRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)

  const localBackupConfig = readLocalBackupConfig()
  const currentLimits = resolveGenerationLimits(lightMode)
  const statusDetail = buildStatusDetail(status, capabilityReport)

  async function handleRefreshCapability() {
    if (!mountedRef.current) {
      return
    }

    setErrorMessage(null)
    setStatus(INITIAL_STATUS)

    try {
      const report = await loadCapabilityReport()
      if (!mountedRef.current) {
        return
      }

      setCapabilityReport(report)
      setStatus({
        detail: report.shouldAttempt
          ? sessionLoaded
            ? 'Browser support still looks good. The current on-device session is still loaded.'
            : 'This device can try in-browser Gemma 4 E2B after you explicitly enable it.'
          : 'On-device mode is blocked on this device or browser configuration.',
        state: report.shouldAttempt
          ? sessionLoaded
            ? 'ready'
            : 'ready-to-download'
          : 'unsupported',
      })
    } catch (error) {
      if (!mountedRef.current) {
        return
      }

      const message =
        error instanceof Error ? error.message : 'Capability checks failed.'

      setErrorMessage(message)
      setStatus({
        detail: 'Capability checks failed before the model could be enabled.',
        state: 'error',
      })
    }
  }

  useEffect(() => {
    mountedRef.current = true

    void (async () => {
      setErrorMessage(null)
      setStatus(INITIAL_STATUS)

      try {
        const report = await loadCapabilityReport()
        if (!mountedRef.current) {
          return
        }

        setCapabilityReport(report)
        setStatus({
          detail: report.shouldAttempt
            ? 'This device can try in-browser Gemma 4 E2B after you explicitly enable it.'
            : 'On-device mode is blocked on this device or browser configuration.',
          state: report.shouldAttempt ? 'ready-to-download' : 'unsupported',
        })
      } catch (error) {
        if (!mountedRef.current) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Capability checks failed.'

        setErrorMessage(message)
        setStatus({
          detail: 'Capability checks failed before the model could be enabled.',
          state: 'error',
        })
      }
    })()

    return () => {
      mountedRef.current = false
      disposeRef.current?.()
      sessionRef.current = null
      disposeRef.current = null
    }
  }, [])

  async function handleEnableOnDeviceMode() {
    if (!capabilityReport?.shouldAttempt) {
      return
    }

    setErrorMessage(null)
    setResponse('')
    setResponseLabel(null)

    try {
      const { bootstrapGemma4Model } = await import(
        '../../lib/on-device/modelBootstrap'
      )
      const resources = await bootstrapGemma4Model({
        lightMode,
        modelAssetPath: capabilityReport.modelAssetPath,
        onPhaseChange: (phase) => {
          setStatus({
            detail: phase.detail,
            state: phase.state,
          })
        },
      })

      disposeRef.current?.()
      disposeRef.current = resources.dispose
      sessionRef.current = new BrowserInferenceSession(resources.llmInference)
      setSessionLoaded(true)

      setStatus({
        detail:
          'Gemma 4 E2B is ready in this tab. Prompts stay short by default to reduce memory pressure.',
        state: 'ready',
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The model failed to load in this browser.'

      console.error('[on-device load failure]', message)
      setErrorMessage(message)
      setSessionLoaded(false)
      setStatus({
        detail: 'Model load failure blocked on-device mode for this session.',
        state: 'error',
      })
    }
  }

  async function handleSendInBrowser() {
    if (!sessionRef.current) {
      return
    }

    setErrorMessage(null)
    setResponse('')
    setResponseLabel(null)
    setStatus({
      detail:
        'Generating a short response on-device. Previous context is not kept in memory.',
      state: 'generating',
    })

    try {
      const finalResponse = await sessionRef.current.generate({
        lightMode,
        onPartial: (partialResult) => {
          setResponse(partialResult)
        },
        prompt,
      })

      setResponse(finalResponse)
      setResponseLabel(`Browser on-device: ${GEMMA4_MODEL_LABEL}`)
      setStatus({
        detail:
          'Generation finished. You can send another short prompt or reset the browser session.',
        state: 'ready',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Generation failed.'

      console.error('[on-device generation failure]', message)
      setErrorMessage(message)
      setStatus({
        detail: 'Generation failed. Reset the session if the tab feels stuck.',
        state: 'error',
      })
    }
  }

  async function handleSendViaLocalBackup() {
    if (!localBackupConfig.configured) {
      return
    }

    setErrorMessage(null)
    setResponse('')
    setResponseLabel(null)
    setIsLocalGenerating(true)

    try {
      const result = await generateLocalBackupResponse({
        lightMode,
        prompt,
      })

      setResponse(result.response)
      setResponseLabel(
        `Local endpoint: ${result.runtimeLabel} / ${result.modelLabel}${
          result.usedFallback ? ' (fallback)' : ''
        }`,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Local endpoint generation failed.'

      console.error('[local backup generation failure]', message)
      setErrorMessage(message)
    } finally {
      setIsLocalGenerating(false)
    }
  }

  function handleHardReset() {
    sessionRef.current?.cancel()
    disposeRef.current?.()
    sessionRef.current = null
    disposeRef.current = null
    setSessionLoaded(false)
    setPrompt('')
    setResponse('')
    setResponseLabel(null)
    setErrorMessage(null)
    setIsLocalGenerating(false)

    if (capabilityReport?.shouldAttempt) {
      setStatus({
        detail:
          'Session resources were released. Enable on-device mode again to reload the model.',
        state: 'ready-to-download',
      })
    } else {
      setStatus({
        detail: 'On-device mode remains blocked for this browser or device.',
        state: 'unsupported',
      })
    }
  }

  const canEnable = status.state === 'ready-to-download'
  const canRetryEnable = status.state === 'error' && !sessionLoaded
  const isBrowserBusy =
    status.state === 'downloading' ||
    status.state === 'loading' ||
    status.state === 'generating'
  const canSendBrowser =
    Boolean(prompt.trim()) &&
    sessionLoaded &&
    !isLocalGenerating &&
    !isBrowserBusy &&
    status.state !== 'unsupported' &&
    status.state !== 'ready-to-download'
  const canSendLocal =
    Boolean(prompt.trim()) &&
    localBackupConfig.configured &&
    !isLocalGenerating &&
    !isBrowserBusy

  return (
    <div className="browser-gemma-panel">
      <div className="browser-gemma-panel__intro">
        <p className="field-message">
          This runs on your device in the browser when supported. Browser mode is
          the primary competition path; the local model endpoint is only for
          development image reading and quick sanity checks.
        </p>
      </div>

      <div className="browser-gemma-panel__status-grid" aria-live="polite">
        <article className="browser-gemma-panel__status-card">
          <div className="browser-gemma-panel__status-header">
            <div>
              <span className="eyebrow">Browser path</span>
              <h3>Gemma 4 E2B in this tab</h3>
            </div>
            <span
              className={`browser-gemma-panel__pill browser-gemma-panel__pill--${getStatusTone(status.state)}`}
            >
              {formatStatusLabel(status.state)}
            </span>
          </div>

          <p className="browser-gemma-panel__detail">{statusDetail}</p>

          {capabilityReport?.warnings.length ? (
            <ul className="compact-list browser-gemma-panel__warnings">
              {capabilityReport.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="screen-actions">
            <button
              className="action-button"
              type="button"
              disabled={!canEnable && !canRetryEnable}
              onClick={() => void handleEnableOnDeviceMode()}
            >
              Enable browser mode
            </button>

            <button
              className="ghost-button"
              type="button"
              onClick={() => void handleRefreshCapability()}
            >
              Re-check support
            </button>

            <button
              className="ghost-button"
              type="button"
              onClick={handleHardReset}
            >
              Hard reset
            </button>
          </div>

          <p className="browser-gemma-panel__microcopy">
            Expected model asset: <code>{DEFAULT_MODEL_ASSET_PATH}</code>
          </p>
        </article>

        <article className="browser-gemma-panel__status-card browser-gemma-panel__status-card--soft">
          <div className="browser-gemma-panel__status-header">
            <div>
              <span className="eyebrow">Local Gemma endpoint</span>
              <h3>Development image reader</h3>
            </div>
            <span
              className={`browser-gemma-panel__pill browser-gemma-panel__pill--${getLocalBackupTone(
                localBackupConfig.configured,
                isLocalGenerating,
              )}`}
            >
              {getLocalBackupLabel(
                localBackupConfig.configured,
                isLocalGenerating,
              )}
            </span>
          </div>

          <p className="browser-gemma-panel__detail">
            {describeLocalBackup(
              localModelPlan,
              localBackupConfig.fallbackLabel,
            )}
          </p>

          <p className="browser-gemma-panel__microcopy">
            {localBackupConfig.configured
              ? 'Use this when the browser model is blocked or you want a quick local sanity check during development.'
              : 'Configure VITE_GEMMA_BASE_URL to expose a local endpoint while keeping the browser model as the main product path.'}
          </p>
        </article>
      </div>

      <div className="browser-gemma-panel__composer">
        <div className="browser-gemma-panel__composer-header">
          <div>
            <span className="eyebrow">Prompt</span>
            <h3>Short testing prompt</h3>
          </div>

          <label className="browser-gemma-panel__toggle">
            <input
              checked={lightMode}
              type="checkbox"
              onChange={(event) => setLightMode(event.target.checked)}
            />
            <span>Light mode</span>
          </label>
        </div>

        <p className="browser-gemma-panel__microcopy">
          Light mode keeps only the current turn, limits response length, and
          avoids hidden context so lower-power phones stay more stable.
        </p>

        <textarea
          className="textarea-input textarea-input--compact browser-gemma-panel__prompt"
          placeholder="Ask one short question. Keep it brief on lower-power phones."
          rows={6}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />

        <div className="screen-actions screen-actions--split">
          <p className="browser-gemma-panel__microcopy">
            Prompt budget: about {currentLimits.maxInputTokens} input tokens,{' '}
            {currentLimits.maxTokens} output tokens.
          </p>

          <div className="upload-actions">
            <button
              className="action-button"
              type="button"
              disabled={!canSendBrowser}
              onClick={() => void handleSendInBrowser()}
            >
              Send in browser
            </button>

            <button
              className="ghost-button"
              type="button"
              disabled={!canSendLocal}
              onClick={() => void handleSendViaLocalBackup()}
            >
              Send via local endpoint
            </button>
          </div>
        </div>
      </div>

      <div className="browser-gemma-panel__response">
        <div className="browser-gemma-panel__response-header">
          <div>
            <span className="eyebrow">Response</span>
            <h3>Last test output</h3>
          </div>
          {responseLabel ? (
            <span className="browser-gemma-panel__response-label">
              {responseLabel}
            </span>
          ) : null}
        </div>

        <div className="browser-gemma-panel__response-surface">
          {response ? (
            <p>{response}</p>
          ) : (
            <p className="browser-gemma-panel__placeholder">
              {status.state === 'unsupported'
                ? 'Browser mode is blocked here. You can still use a configured local endpoint for testing.'
                : 'Load the model, then send a short prompt through the browser or local endpoint path.'}
            </p>
          )}
        </div>

        {errorMessage ? (
          <p className="browser-gemma-panel__error">{errorMessage}</p>
        ) : null}
      </div>

      <div className="browser-gemma-panel__footer">
        <div className="browser-gemma-panel__links">
          <a href={OFFICIAL_WEB_MODEL_URL} rel="noreferrer" target="_blank">
            Official Gemma 4 E2B web model
          </a>
          <a href={OFFICIAL_MODEL_PAGE_URL} rel="noreferrer" target="_blank">
            LiteRT community model page
          </a>
        </div>

        <button
          className="ghost-button"
          type="button"
          onClick={() => setShowDebug((current) => !current)}
        >
          {showDebug ? 'Hide debug panel' : 'Show debug panel'}
        </button>
      </div>

      {showDebug && capabilityReport ? (
        <dl className="browser-gemma-panel__debug-grid">
          <div>
            <dt>WebGPU available</dt>
            <dd>{capabilityReport.webGpuAvailable ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt>deviceMemory</dt>
            <dd>
              {capabilityReport.deviceMemoryGiB === null
                ? 'unknown'
                : `${capabilityReport.deviceMemoryGiB} GiB`}
            </dd>
          </div>
          <div>
            <dt>Browser gate</dt>
            <dd>{capabilityReport.shouldAttempt ? 'allow' : 'block'}</dd>
          </div>
          <div>
            <dt>Model asset path</dt>
            <dd>{capabilityReport.modelAssetPath}</dd>
          </div>
          <div>
            <dt>Browser</dt>
            <dd>{capabilityReport.browserLabel}</dd>
          </div>
          <div>
            <dt>Local endpoint</dt>
            <dd>{localBackupConfig.configured ? 'configured' : 'not configured'}</dd>
          </div>
          <div>
            <dt>Local runtime</dt>
            <dd>{localBackupConfig.runtimeLabel}</dd>
          </div>
          <div>
            <dt>Local model plan</dt>
            <dd>
              {localBackupConfig.primaryLabel}
              {localBackupConfig.fallbackLabel
                ? ` -> ${localBackupConfig.fallbackLabel}`
                : ''}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}
