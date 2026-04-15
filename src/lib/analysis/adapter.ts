import type {
  AnalysisExecution,
  AnalysisRequest,
  TeacherConcernExecution,
  TeacherConcernRequest,
} from '../../types/analysis'

export interface ModelPlan {
  fallbackLabel: string
  liveConfigured: boolean
  multimodalReady: boolean
  primaryLabel: string
  runtimeLabel: string
}

export interface AnalysisModelAdapter {
  analyze: (request: AnalysisRequest) => Promise<AnalysisExecution>
  analyzeTeacherConcern: (
    request: TeacherConcernRequest,
  ) => Promise<TeacherConcernExecution>
  getModelPlan: () => ModelPlan
}
