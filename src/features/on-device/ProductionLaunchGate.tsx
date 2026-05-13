import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import {
  inspectOnDeviceCapability,
  logCapabilityReport,
} from '../../lib/on-device/capabilityCheck'
import { bootstrapGemma4Model } from '../../lib/on-device/modelBootstrap'
import {
  DEFAULT_MODEL_ASSET_PATH,
  GEMMA4_MODEL_LABEL,
} from '../../lib/on-device/modelConfig'
import {
  getModelDownloadNetworkStatus,
  type ModelDownloadNetworkStatus,
} from '../../lib/on-device/modelDownloadNetwork'
import { buildProductionLaunchGateDecision } from '../../lib/on-device/productionLaunchGate'
import type { CapabilityReport } from '../../lib/on-device/types'

interface ProductionLaunchGateProps {
  children: ReactNode
  enabled: boolean
}

type GateState =
  | { status: 'checking' }
  | {
      networkStatus: ModelDownloadNetworkStatus
      report: CapabilityReport
      status: 'needs-load'
    }
  | { elapsedMs: number; phaseDetail: string; phaseLabel: string; status: 'loading-model' }
  | { status: 'model-loaded' }
  | { status: 'ready' }
  | { status: 'blocked'; report: CapabilityReport }
  | { message: string; status: 'error' }

async function loadCapabilityReport() {
  const report = await inspectOnDeviceCapability(DEFAULT_MODEL_ASSET_PATH)
  logCapabilityReport(report)
  return report
}

export function ProductionLaunchGate({
  children,
  enabled,
}: ProductionLaunchGateProps) {
  const [gateState, setGateState] = useState<GateState>({ status: 'checking' })
  const [checkCount, setCheckCount] = useState(0)
  const loadIdRef = useRef(0)
  const loadStartedAtRef = useRef<number | null>(null)
  const disposeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isMounted = true

    async function checkCapability() {
      setGateState({ status: 'checking' })

      try {
        const report = await loadCapabilityReport()

        if (!isMounted) {
          return
        }

        setGateState(
          report.shouldAttempt
            ? {
                networkStatus: getModelDownloadNetworkStatus(),
                report,
                status: 'needs-load',
              }
            : { report, status: 'blocked' },
        )
      } catch (error) {
        if (!isMounted) {
          return
        }

        setGateState({
          message:
            error instanceof Error
              ? error.message
              : 'IEP Compass could not check this browser.',
          status: 'error',
        })
      }
    }

    void checkCapability()

    return () => {
      isMounted = false
    }
  }, [checkCount, enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }

    return () => {
      disposeRef.current?.()
      disposeRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (gateState.status !== 'loading-model') {
      return
    }

    const intervalId = window.setInterval(() => {
      const startedAt = loadStartedAtRef.current

      if (!startedAt) {
        return
      }

      setGateState((current) =>
        current.status === 'loading-model'
          ? { ...current, elapsedMs: Date.now() - startedAt }
          : current,
      )
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [gateState.status])

  if (!enabled) {
    return <>{children}</>
  }

  if (gateState.status === 'ready') {
    return <>{children}</>
  }

  if (gateState.status === 'checking') {
    return (
      <div className="app-shell production-gate">
        <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
        <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

        <main className="production-gate__panel" aria-live="polite">
          <span className="eyebrow eyebrow--hero">
            <AppIcon name="compass" className="button-icon button-icon--sm" />
            Checking browser model support
          </span>
          <h1>IEP Compass</h1>
          <LoadingIndicator label={`Checking whether ${GEMMA4_MODEL_LABEL} can run here.`} />
          <p className="production-gate__copy">
            This production version opens only when the configured browser model is
            available on this device.
          </p>
        </main>
      </div>
    )
  }

  if (gateState.status === 'error') {
    return (
      <UnsupportedDeviceScreen
        body="IEP Compass could not confirm browser-model support for this session."
        details={[gateState.message]}
        onRecheck={() => setCheckCount((current) => current + 1)}
        title="Browser check did not finish"
      />
    )
  }

  if (gateState.status === 'needs-load') {
    return (
      <ModelLoadScreen
        networkStatus={gateState.networkStatus}
        onLoad={() => {
          loadIdRef.current += 1
          void loadBrowserModel(loadIdRef.current)
        }}
        onRecheck={() => setCheckCount((current) => current + 1)}
      />
    )
  }

  if (gateState.status === 'loading-model') {
    return (
      <ModelLoadingScreen
        elapsedMs={gateState.elapsedMs}
        phaseDetail={gateState.phaseDetail}
        phaseLabel={gateState.phaseLabel}
      />
    )
  }

  if (gateState.status === 'model-loaded') {
    return (
      <ModelLoadedScreen onStart={() => setGateState({ status: 'ready' })} />
    )
  }

  const decision = buildProductionLaunchGateDecision(gateState.report)

  return (
    <UnsupportedDeviceScreen
      body={decision.body}
      details={decision.details}
      onRecheck={() => setCheckCount((current) => current + 1)}
      title={decision.title}
    />
  )

  async function loadBrowserModel(currentLoadId: number) {
    try {
      const report = await loadCapabilityReport()
      const networkStatus = getModelDownloadNetworkStatus()

      if (!report.shouldAttempt) {
        setGateState({ report, status: 'blocked' })
        return
      }

      if (!networkStatus.canDownload) {
        setGateState({
          networkStatus,
          report,
          status: 'needs-load',
        })
        return
      }

      loadStartedAtRef.current = Date.now()
      setGateState({
        elapsedMs: 0,
        phaseDetail:
          'Starting the browser-managed model fetch. Keep this tab open while Gemma loads.',
        phaseLabel: 'Getting Gemma',
        status: 'loading-model',
      })

      const resources = await bootstrapGemma4Model({
        lightMode: true,
        modelAssetPath: report.modelAssetPath,
        onPhaseChange: (phase) => {
          if (loadIdRef.current !== currentLoadId) {
            return
          }

          setGateState((current) => ({
            elapsedMs:
              current.status === 'loading-model' ? current.elapsedMs : 0,
            phaseDetail: phase.detail,
            phaseLabel:
              phase.state === 'downloading'
                ? 'Getting the model'
                : 'Loading Gemma',
            status: 'loading-model',
          }))
        },
      })

      if (loadIdRef.current !== currentLoadId) {
        resources.dispose()
        return
      }

      disposeRef.current?.()
      disposeRef.current = resources.dispose
      setGateState({ status: 'model-loaded' })
    } catch (error) {
      if (loadIdRef.current !== currentLoadId) {
        return
      }

      setGateState({
        message:
          error instanceof Error
            ? error.message
            : 'Gemma could not finish loading in this browser.',
        status: 'error',
      })
    }
  }
}

function formatElapsedTime(elapsedMs: number) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`
}

function ModelLoadScreen({
  networkStatus,
  onLoad,
  onRecheck,
}: {
  networkStatus: ModelDownloadNetworkStatus
  onLoad: () => void
  onRecheck: () => void
}) {
  return (
    <div className="app-shell production-gate">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <main className="production-gate__panel" aria-live="polite">
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="compass" className="button-icon button-icon--sm" />
          Browser model setup
        </span>
        <h1>Get Gemma before you start</h1>
        <p className="production-gate__lede">
          IEP Compass needs {GEMMA4_MODEL_LABEL} loaded in this browser before
          the model-powered parts of the app open.
        </p>

        <div
          className={`production-gate__details production-gate__details--${networkStatus.state}`}
        >
          <strong>{networkStatus.label}</strong>
          <p>{networkStatus.detail}</p>
        </div>

        <p className="production-gate__copy">
          This is a large browser model. The app will not start the download on
          mobile data or while Data Saver is on. Connect to Wi-Fi, keep this tab
          open, then load the model.
        </p>

        <div className="screen-actions">
          <button
            className="action-button"
            type="button"
            disabled={!networkStatus.canDownload}
            onClick={onLoad}
          >
            <AppIcon name="spark" className="button-icon" />
            Load Gemma on Wi-Fi
          </button>

          <button className="ghost-button" type="button" onClick={onRecheck}>
            <AppIcon name="waypoint" className="button-icon" />
            Re-check Wi-Fi and browser
          </button>
        </div>
      </main>
    </div>
  )
}

function ModelLoadingScreen({
  elapsedMs,
  phaseDetail,
  phaseLabel,
}: {
  elapsedMs: number
  phaseDetail: string
  phaseLabel: string
}) {
  return (
    <div className="app-shell production-gate">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <main className="production-gate__panel" aria-live="polite">
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="spark" className="button-icon button-icon--sm" />
          {phaseLabel}
        </span>
        <h1>Gemma is loading</h1>
        <LoadingIndicator label={`${phaseDetail} ${formatElapsedTime(elapsedMs)} elapsed.`} />
        <p className="production-gate__copy">
          Leave this tab open and stay on Wi-Fi. The browser model can take a
          while the first time; that is expected for a model this large.
        </p>
      </main>
    </div>
  )
}

function ModelLoadedScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="app-shell production-gate">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <main className="production-gate__panel" aria-live="polite">
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="check" className="button-icon button-icon--sm" />
          Model loaded
        </span>
        <h1>Gemma is ready</h1>
        <p className="production-gate__lede">
          The browser model finished loading for this tab. You can start IEP
          Compass now.
        </p>
        <button className="action-button" type="button" onClick={onStart}>
          <AppIcon name="results" className="button-icon" />
          Start IEP Compass
        </button>
      </main>
    </div>
  )
}

function UnsupportedDeviceScreen({
  body,
  details,
  onRecheck,
  title,
}: {
  body: string
  details: string[]
  onRecheck: () => void
  title: string
}) {
  return (
    <div className="app-shell production-gate">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <main className="production-gate__panel production-gate__panel--blocked">
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="shield" className="button-icon button-icon--sm" />
          Browser model required
        </span>
        <h1>{title}</h1>
        <p className="production-gate__lede">{body}</p>

        {details.length ? (
          <div className="production-gate__details">
            <strong>What blocked this device</strong>
            <ul className="compact-list">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="production-gate__copy">
          IEP Compass uses the browser model as part of the core experience, so
          this launch does not offer a non-AI or local-backup version.
        </p>

        <button className="ghost-button" type="button" onClick={onRecheck}>
          <AppIcon name="waypoint" className="button-icon" />
          Re-check this browser
        </button>
      </main>
    </div>
  )
}
