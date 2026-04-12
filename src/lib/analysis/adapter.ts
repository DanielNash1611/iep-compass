import type { AnalysisExecution, AnalysisRequest } from '../../types/analysis'

export interface ModelPlan {
  fallbackLabel: string
  multimodalReady: boolean
  primaryLabel: string
  remoteConfigured: boolean
}

export interface AnalysisModelAdapter {
  analyze: (request: AnalysisRequest) => Promise<AnalysisExecution>
  getModelPlan: () => ModelPlan
}
