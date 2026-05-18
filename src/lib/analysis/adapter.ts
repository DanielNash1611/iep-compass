import type {
  AnalysisExecution,
  AnalysisOptions,
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
  analyze: (
    request: AnalysisRequest,
    options?: AnalysisOptions,
  ) => Promise<AnalysisExecution>
  analyzeTeacherConcern: (
    request: TeacherConcernRequest,
  ) => Promise<TeacherConcernExecution>
  getModelPlan: () => ModelPlan
}
