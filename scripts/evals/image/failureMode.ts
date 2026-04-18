export type ImageEvalFailureMode =
  | 'none'
  | 'runtime_transport'
  | 'timeout'
  | 'server'
  | 'other'

const TIMEOUT_PATTERNS = [
  /did not finish within/i,
  /did not start streaming within/i,
  /idle for more than/i,
  /timed out/i,
  /timeout/i,
]

const RUNTIME_TRANSPORT_PATTERNS = [
  /did not receive done or success response in stream/i,
  /fetch failed/i,
  /socket hang up/i,
  /econnreset/i,
  /connection reset/i,
  /connection refused/i,
  /network/i,
  /stream/i,
  /aborted/i,
  /terminated/i,
]

const SERVER_PATTERNS = [
  /model request failed with 5\d\d/i,
  /model request failed with 429/i,
  /gemma .* request failed with 5\d\d/i,
]

export function classifyImageEvalFailure(message?: string): ImageEvalFailureMode {
  if (!message?.trim()) {
    return 'none'
  }

  if (TIMEOUT_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'timeout'
  }

  if (SERVER_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'server'
  }

  if (RUNTIME_TRANSPORT_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'runtime_transport'
  }

  return 'other'
}

export function isRetryableRuntimeFailure(message?: string) {
  const failureMode = classifyImageEvalFailure(message)
  return failureMode === 'runtime_transport' || failureMode === 'timeout' || failureMode === 'server'
}
