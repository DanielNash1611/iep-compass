import type { CapabilityReport, GateReason } from './types'

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number
}

function getDeviceMemoryGiB() {
  const navigatorWithHints = navigator as NavigatorWithHints
  return typeof navigatorWithHints.deviceMemory === 'number'
    ? navigatorWithHints.deviceMemory
    : null
}

function detectBrowser(userAgent: string) {
  const isAndroid = /Android/i.test(userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isFirefox = /Firefox|FxiOS/i.test(userAgent)
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|CriOS|Chromium|Edg|OPR/i.test(userAgent)
  const isChromium =
    /Chrome|CriOS|Chromium|Edg/i.test(userAgent) && !/OPR/i.test(userAgent)

  const supported =
    (isAndroid && /Chrome/i.test(userAgent)) ||
    (!isAndroid && !isIOS && isChromium && !isFirefox && !isSafari)

  let browserLabel = 'Unknown browser'

  if (isAndroid && /Chrome/i.test(userAgent)) {
    browserLabel = 'Chrome on Android'
  } else if (!isAndroid && !isIOS && /Edg/i.test(userAgent)) {
    browserLabel = 'Edge desktop'
  } else if (!isAndroid && !isIOS && isChromium) {
    browserLabel = 'Chromium desktop'
  } else if (isIOS) {
    browserLabel = 'iOS browser'
  } else if (isFirefox) {
    browserLabel = 'Firefox'
  } else if (isSafari) {
    browserLabel = 'Safari'
  }

  return {
    browserLabel,
    supported,
  }
}

export function isPlausibleModelAssetResponse(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const contentLength = Number(response.headers.get('content-length') ?? 0)

  if (!response.ok && response.status !== 206) {
    return false
  }

  if (contentType.includes('text/html')) {
    return false
  }

  return !Number.isFinite(contentLength) || contentLength === 0 || contentLength > 1_000_000
}

async function probeModelAsset(modelAssetPath: string) {
  try {
    const response = await fetch(modelAssetPath, {
      cache: 'no-store',
      method: 'HEAD',
    })

    if (isPlausibleModelAssetResponse(response)) {
      return true
    }
  } catch {
    // Fall through to the tiny GET probe below.
  }

  try {
    const response = await fetch(modelAssetPath, {
      cache: 'no-store',
      headers: {
        Range: 'bytes=0-0',
      },
    })

    return isPlausibleModelAssetResponse(response)
  } catch {
    return false
  }
}

function buildGateReasons(input: {
  browserSupported: boolean
  deviceMemoryGiB: number | null
  modelAssetReachable: boolean
  webGpuAvailable: boolean
}): GateReason[] {
  const gateReasons: GateReason[] = []

  if (!input.webGpuAvailable) {
    gateReasons.push({
      code: 'no-webgpu',
      detail: 'WebGPU is not available in this browser context.',
    })
  }

  if (!input.browserSupported) {
    gateReasons.push({
      code: 'unsupported-browser',
      detail:
        'This app is tuned for Chrome on Android and Chromium desktop browsers.',
    })
  }

  if (
    input.deviceMemoryGiB !== null &&
    Number.isFinite(input.deviceMemoryGiB) &&
    input.deviceMemoryGiB < 8
  ) {
    gateReasons.push({
      code: 'low-device-memory',
      detail:
        'The browser reports less than 8 GiB of device memory, which is below the conservative on-device gate for Gemma 4 E2B.',
    })
  }

  if (!input.modelAssetReachable) {
    gateReasons.push({
      code: 'model-asset-unavailable',
      detail:
        'The configured browser model asset could not be reached. Add the official web task file or update the model path.',
    })
  }

  return gateReasons
}

function buildWarnings(input: {
  browserLabel: string
  deviceMemoryGiB: number | null
  isSecureContext: boolean
}) {
  const warnings: string[] = []

  if (!input.isSecureContext) {
    warnings.push(
      'WebGPU generally requires a secure context. Use HTTPS or localhost during testing.',
    )
  }

  if (input.deviceMemoryGiB === null) {
    warnings.push(
      'The browser did not expose navigator.deviceMemory, so the memory gate is based on other signals only.',
    )
  } else if (input.deviceMemoryGiB < 8) {
    warnings.push(
      'This device is near the low end for Gemma 4 E2B in-browser inference. Light mode is strongly recommended.',
    )
  }

  if (input.browserLabel !== 'Chrome on Android') {
    warnings.push(
      'Chrome on Android is the primary mobile target for this build.',
    )
  }

  return warnings
}

export async function inspectOnDeviceCapability(
  modelAssetPath: string,
): Promise<CapabilityReport> {
  const userAgent = navigator.userAgent
  const browser = detectBrowser(userAgent)
  const deviceMemoryGiB = getDeviceMemoryGiB()
  const webGpuAvailable =
    typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu)
  const isSecureContext = window.isSecureContext
  const modelAssetReachable = await probeModelAsset(modelAssetPath)

  const gateReasons = buildGateReasons({
    browserSupported: browser.supported && isSecureContext,
    deviceMemoryGiB,
    modelAssetReachable,
    webGpuAvailable,
  })

  const warnings = buildWarnings({
    browserLabel: browser.browserLabel,
    deviceMemoryGiB,
    isSecureContext,
  })

  return {
    browserLabel: browser.browserLabel,
    deviceMemoryGiB,
    gateReasons,
    isSecureContext,
    modelAssetPath,
    modelAssetReachable,
    shouldAttempt: gateReasons.length === 0,
    userAgent,
    warnings,
    webGpuAvailable,
  }
}

export function logCapabilityReport(report: CapabilityReport) {
  if (report.shouldAttempt) {
    console.info('[on-device gate] enabled', {
      browser: report.browserLabel,
      deviceMemoryGiB: report.deviceMemoryGiB,
      modelAssetPath: report.modelAssetPath,
      webGpuAvailable: report.webGpuAvailable,
    })
    return
  }

  report.gateReasons.forEach((reason) => {
    console.warn(`[on-device gate] blocked: ${reason.code}`, reason.detail)
  })
}
