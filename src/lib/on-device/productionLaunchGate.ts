import type { CapabilityReport } from './types'

export interface ProductionLaunchGateDecision {
  body: string
  details: string[]
  isAllowed: boolean
  title: string
}

function isIosUserAgent(userAgent: string) {
  return /iPhone|iPad|iPod/i.test(userAgent)
}

function getBlockerDetails(report: CapabilityReport) {
  return report.gateReasons.map((reason) => reason.detail)
}

export function buildProductionLaunchGateDecision(
  report: CapabilityReport,
): ProductionLaunchGateDecision {
  if (report.shouldAttempt) {
    return {
      body: 'This browser can reach the configured Gemma browser model and meets the launch requirements for IEP Compass.',
      details: [],
      isAllowed: true,
      title: 'Browser model ready',
    }
  }

  const details = getBlockerDetails(report)

  if (isIosUserAgent(report.userAgent)) {
    return {
      body: 'This production launch needs a browser and device that can run the configured Gemma browser model. iPhone and iPad browsers are not supported for this version of IEP Compass.',
      details,
      isAllowed: false,
      title: 'This device is not supported yet',
    }
  }

  return {
    body: 'This production launch only opens on browsers and devices that can run the configured Gemma browser model. Try Chrome on a supported Android device, or a Chromium desktop browser with WebGPU enabled.',
    details,
    isAllowed: false,
    title: 'Browser model is required',
  }
}
