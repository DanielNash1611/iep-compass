import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildProductionLaunchGateDecision,
} from '../../src/lib/on-device/productionLaunchGate.ts'
import {
  isPlausibleModelAssetResponse,
} from '../../src/lib/on-device/capabilityCheck.ts'
import {
  classifyModelDownloadNetwork,
} from '../../src/lib/on-device/modelDownloadNetwork.ts'

function buildReport(overrides = {}) {
  return {
    browserLabel: 'Chrome on Android',
    deviceMemoryGiB: 8,
    gateReasons: [],
    isSecureContext: true,
    modelAssetPath: 'https://example.com/gemma-4-E2B-it-web.task',
    modelAssetReachable: true,
    shouldAttempt: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36',
    warnings: [],
    webGpuAvailable: true,
    ...overrides,
  }
}

test('production launch gate allows capable Chrome Android reports', () => {
  const decision = buildProductionLaunchGateDecision(buildReport())

  assert.equal(decision.isAllowed, true)
  assert.match(decision.title, /ready/i)
  assert.equal(decision.details.length, 0)
})

test('production launch gate blocks iOS with explicit unsupported-device copy', () => {
  const decision = buildProductionLaunchGateDecision(
    buildReport({
      browserLabel: 'iOS browser',
      gateReasons: [
        {
          code: 'unsupported-browser',
          detail:
            'This app is tuned for Chrome on Android and Chromium desktop browsers.',
        },
      ],
      shouldAttempt: false,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
      webGpuAvailable: false,
    }),
  )

  assert.equal(decision.isAllowed, false)
  assert.match(decision.title, /not supported/i)
  assert.match(decision.body, /iPhone and iPad browsers are not supported/i)
})

test('production launch gate reports missing WebGPU as a blocker', () => {
  const decision = buildProductionLaunchGateDecision(
    buildReport({
      gateReasons: [
        {
          code: 'no-webgpu',
          detail: 'WebGPU is not available in this browser context.',
        },
      ],
      shouldAttempt: false,
      webGpuAvailable: false,
    }),
  )

  assert.equal(decision.isAllowed, false)
  assert.match(decision.body, /configured Gemma browser model/i)
  assert.deepEqual(decision.details, [
    'WebGPU is not available in this browser context.',
  ])
})

test('production launch gate reports low device memory as a blocker', () => {
  const decision = buildProductionLaunchGateDecision(
    buildReport({
      deviceMemoryGiB: 4,
      gateReasons: [
        {
          code: 'low-device-memory',
          detail:
            'The browser reports less than 8 GiB of device memory, which is below the conservative on-device gate for Gemma 4 E2B.',
        },
      ],
      shouldAttempt: false,
    }),
  )

  assert.equal(decision.isAllowed, false)
  assert.match(decision.details.join(' '), /less than 8 GiB/)
})

test('production launch gate reports unreachable model assets as a blocker', () => {
  const decision = buildProductionLaunchGateDecision(
    buildReport({
      gateReasons: [
        {
          code: 'model-asset-unavailable',
          detail:
            'The configured browser model asset could not be reached. Add the official web task file or update the model path.',
        },
      ],
      modelAssetReachable: false,
      shouldAttempt: false,
    }),
  )

  assert.equal(decision.isAllowed, false)
  assert.match(decision.details.join(' '), /model asset could not be reached/i)
})

test('model asset probe rejects SPA HTML fallback responses', () => {
  const response = new Response('<!doctype html><div id="root"></div>', {
    headers: {
      'content-length': '591',
      'content-type': 'text/html',
    },
    status: 200,
  })

  assert.equal(isPlausibleModelAssetResponse(response), false)
})

test('model asset probe accepts large binary-looking model responses', () => {
  const response = new Response(null, {
    headers: {
      'content-length': '2003697664',
      'content-type': 'application/octet-stream',
    },
    status: 200,
  })

  assert.equal(isPlausibleModelAssetResponse(response), true)
})

test('model download network allows reported Wi-Fi', () => {
  const status = classifyModelDownloadNetwork(
    { type: 'wifi' },
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36',
  )

  assert.equal(status.canDownload, true)
  assert.equal(status.state, 'allowed')
  assert.match(status.label, /Wi-Fi/i)
})

test('model download network blocks reported mobile data', () => {
  const status = classifyModelDownloadNetwork(
    { type: 'cellular' },
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36',
  )

  assert.equal(status.canDownload, false)
  assert.equal(status.state, 'blocked')
  assert.match(status.detail, /mobile-data connection/i)
})

test('model download network blocks mobile browsers when Wi-Fi is unknown', () => {
  const status = classifyModelDownloadNetwork(
    {},
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36',
  )

  assert.equal(status.canDownload, false)
  assert.equal(status.state, 'unknown')
  assert.match(status.detail, /did not confirm Wi-Fi/i)
})

test('model download network blocks Data Saver', () => {
  const status = classifyModelDownloadNetwork(
    { saveData: true, type: 'wifi' },
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36',
  )

  assert.equal(status.canDownload, false)
  assert.equal(status.state, 'blocked')
  assert.match(status.detail, /Data Saver/i)
})
