import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrandLockup } from '../../components/BrandLockup'
import { AppIcon } from '../../components/AppIcon'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import {
  inspectOnDeviceCapability,
  logCapabilityReport,
} from '../../lib/on-device/capabilityCheck'
import {
  DEFAULT_MODEL_ASSET_PATH,
  GEMMA4_MODEL_LABEL,
} from '../../lib/on-device/modelConfig'
import {
  getModelDownloadNetworkStatus,
  type ModelDownloadNetworkStatus,
} from '../../lib/on-device/modelDownloadNetwork'
import {
  ensureCachedModelAsset,
  hasCachedModelAsset,
} from '../../lib/on-device/modelAssetCache'
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

function canUseCachedModel(report: CapabilityReport, modelAlreadyCached: boolean) {
  if (report.shouldAttempt) {
    return true
  }

  return (
    modelAlreadyCached &&
    report.gateReasons.every((reason) => reason.code === 'model-asset-unavailable')
  )
}

export function ProductionLaunchGate({
  children,
  enabled,
}: ProductionLaunchGateProps) {
  const [gateState, setGateState] = useState<GateState>({ status: 'checking' })
  const [checkCount, setCheckCount] = useState(0)
  const loadIdRef = useRef(0)
  const loadStartedAtRef = useRef<number | null>(null)

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

        const modelAlreadyCached = await hasCachedModelAsset(report.modelAssetPath)

        if (!isMounted) {
          return
        }

        if (!canUseCachedModel(report, modelAlreadyCached)) {
          setGateState({ report, status: 'blocked' })
          return
        }

        if (modelAlreadyCached) {
          setGateState({ status: 'ready' })
          return
        }

        setGateState({
          networkStatus: getModelDownloadNetworkStatus(),
          report,
          status: 'needs-load',
        })
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

    async function resumeReadyModelSession() {
      if (document.visibilityState === 'hidden') {
        return
      }

      if (gateState.status === 'ready' || gateState.status === 'loading-model') {
        return
      }

      if (await hasCachedModelAsset(DEFAULT_MODEL_ASSET_PATH)) {
        setGateState({ status: 'ready' })
      }
    }

    const handleResume = () => {
      void resumeReadyModelSession()
    }

    window.addEventListener('focus', handleResume)
    window.addEventListener('pageshow', handleResume)
    document.addEventListener('visibilitychange', handleResume)

    return () => {
      window.removeEventListener('focus', handleResume)
      window.removeEventListener('pageshow', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
    }
  }, [enabled, gateState.status])

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
        <BrandLockup compact className="production-gate__brand" />
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="compass" className="button-icon button-icon--sm" />
          Browser model check
        </span>
        <h1>Checking browser model support</h1>
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
          void cacheBrowserModel(loadIdRef.current)
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

  async function cacheBrowserModel(
    currentLoadId: number,
    options: {
      precheckedReport?: CapabilityReport
    } = {},
  ) {
    try {
      const report = options.precheckedReport ?? await loadCapabilityReport()
      const networkStatus = getModelDownloadNetworkStatus()
      const modelAlreadyCached = await hasCachedModelAsset(report.modelAssetPath)

      if (!canUseCachedModel(report, modelAlreadyCached)) {
        setGateState({ report, status: 'blocked' })
        return
      }

      if (!modelAlreadyCached && !networkStatus.canDownload) {
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
          'Checking browser storage before saving Gemma. Keep this tab open during setup.',
        phaseLabel: 'Getting Gemma',
        status: 'loading-model',
      })

      await ensureCachedModelAsset(report.modelAssetPath, (progress) => {
        if (loadIdRef.current !== currentLoadId) {
          return
        }

        setGateState((current) => ({
          elapsedMs: current.status === 'loading-model' ? current.elapsedMs : 0,
          phaseDetail: progress.detail,
          phaseLabel:
            progress.source === 'cache-storage'
              ? 'Checking saved model'
              : 'Saving the model',
          status: 'loading-model',
        }))
      })

      if (loadIdRef.current !== currentLoadId) {
        return
      }

      setGateState({ status: 'model-loaded' })
    } catch (error) {
      if (loadIdRef.current !== currentLoadId) {
        return
      }

      setGateState({
        message:
          error instanceof Error
            ? error.message
            : 'Gemma could not finish saving in this browser.',
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
          IEP Compass needs {GEMMA4_MODEL_LABEL} saved in this browser before
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
          open, then download and save the model. Future visits can reuse the
          saved file until browser storage is cleared or evicted, without keeping
          Gemma loaded while you upload a photo.
        </p>

        <div className="screen-actions">
          <button
            className="action-button"
            type="button"
            disabled={!networkStatus.canDownload}
            onClick={onLoad}
          >
            <AppIcon name="spark" className="button-icon" />
            Download and save Gemma
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
        <BrandLockup compact className="production-gate__brand" />
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="spark" className="button-icon button-icon--sm" />
          {phaseLabel}
        </span>
        <h1>Gemma is being saved</h1>
        <LoadingIndicator label={`${phaseDetail} ${formatElapsedTime(elapsedMs)} elapsed.`} />
        <p className="production-gate__copy">
          Leave this tab open. The first Wi-Fi download can take a while; later
          visits should open from the model file saved in this browser.
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
        <BrandLockup compact className="production-gate__brand" />
        <span className="eyebrow eyebrow--hero">
          <AppIcon name="check" className="button-icon button-icon--sm" />
          Model saved
        </span>
        <h1>Gemma is saved</h1>
        <p className="production-gate__lede">
          The browser model file is saved on this device. IEP Compass can start
          now without keeping Gemma loaded during photo upload.
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
        <BrandLockup compact className="production-gate__brand" />
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
