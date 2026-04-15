export type ModelStatus =
  | 'unsupported'
  | 'ready-to-download'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error'

export type GateReasonCode =
  | 'no-webgpu'
  | 'low-device-memory'
  | 'unsupported-browser'
  | 'model-asset-unavailable'

export interface GateReason {
  code: GateReasonCode
  detail: string
}

export interface CapabilityReport {
  browserLabel: string
  deviceMemoryGiB: number | null
  gateReasons: GateReason[]
  isSecureContext: boolean
  modelAssetPath: string
  modelAssetReachable: boolean
  shouldAttempt: boolean
  userAgent: string
  warnings: string[]
  webGpuAvailable: boolean
}

export interface StatusSnapshot {
  detail: string
  state: ModelStatus
}

export interface GenerateOptions {
  lightMode: boolean
  prompt: string
  onPartial?: (partial: string, done: boolean) => void
}
