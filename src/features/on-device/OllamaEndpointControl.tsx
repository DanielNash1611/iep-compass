import { useEffect, useId, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import type { ResolvedOllamaEndpoint } from '../../lib/on-device/ollamaEndpointConfig'
import {
  clearSavedOllamaEndpoint,
  normalizeOllamaEndpoint,
  resolveOllamaEndpoint,
  saveOllamaEndpoint,
  testOllamaEndpoint,
} from '../../lib/on-device/ollamaEndpointConfig'

interface OllamaEndpointControlProps {
  endpoint: ResolvedOllamaEndpoint
  onEndpointChange: (endpoint: ResolvedOllamaEndpoint) => void
}

export function OllamaEndpointControl({
  endpoint,
  onEndpointChange,
}: OllamaEndpointControlProps) {
  const latestEndpoint = resolveOllamaEndpoint()
  const visibleEndpoint =
    endpoint.source === 'none' && latestEndpoint.source !== 'none'
      ? latestEndpoint
      : endpoint
  const endpointInputId = useId()
  const [draftEndpoint, setDraftEndpoint] = useState(
    visibleEndpoint.savedBaseUrl ?? '',
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'error' | 'ready' | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    setDraftEndpoint(visibleEndpoint.savedBaseUrl ?? '')
  }, [visibleEndpoint.savedBaseUrl])

  function handleSave() {
    const savedEndpoint = saveOllamaEndpoint(draftEndpoint)

    if (!savedEndpoint) {
      setStatusTone('error')
      setStatusMessage('Add an endpoint before saving.')
      return
    }

    setDraftEndpoint(savedEndpoint)
    setStatusTone('ready')
    setStatusMessage('Saved for this browser.')
    onEndpointChange(resolveOllamaEndpoint())
  }

  async function handleTest() {
    const endpointToTest =
      normalizeOllamaEndpoint(draftEndpoint) ?? visibleEndpoint.baseUrl ?? ''

    setIsTesting(true)
    setStatusMessage(null)
    setStatusTone(null)

    try {
      const testedEndpoint = await testOllamaEndpoint(endpointToTest)
      setDraftEndpoint(testedEndpoint)
      setStatusTone('ready')
      setStatusMessage('Endpoint is reachable.')
    } catch (error) {
      setStatusTone('error')
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'The endpoint could not be reached.',
      )
    } finally {
      setIsTesting(false)
    }
  }

  function handleClear() {
    clearSavedOllamaEndpoint()
    setDraftEndpoint('')
    setStatusTone(null)
    setStatusMessage(
      visibleEndpoint.envBaseUrl
        ? 'Saved endpoint cleared. The app is using the .env.local endpoint again.'
        : 'Saved endpoint cleared.',
    )
    onEndpointChange(resolveOllamaEndpoint())
  }

  const statusBadge =
    visibleEndpoint.source === 'saved'
      ? 'Saved'
      : visibleEndpoint.source === 'env'
        ? 'From .env.local'
        : 'Optional'

  return (
    <details className="ollama-endpoint-control">
      <summary className="ollama-endpoint-control__summary">
        <span className="summary-label">
          <AppIcon name="spark" className="button-icon button-icon--sm" />
          Set up a local image reader
        </span>
        <span className="meta-badge">{statusBadge}</span>
      </summary>

      <div className="ollama-endpoint-control__body">
        <label className="field-label" htmlFor={endpointInputId}>
          <span className="field-label__help">
            Optional. Enter the OpenAI-compatible Ollama URL for this browser, or
            run the app locally with <code>VITE_GEMMA_BASE_URL=/api/ollama</code> in{' '}
            <code>.env.local</code>.
          </span>
        </label>

        <div className="ollama-endpoint-control__row">
        <input
          id={endpointInputId}
          className="text-input"
          placeholder="http://127.0.0.1:11434/v1"
          type="url"
          value={draftEndpoint}
          onChange={(event) => {
            setDraftEndpoint(event.target.value)
            setStatusMessage(null)
            setStatusTone(null)
          }}
        />
        <button className="action-button" type="button" onClick={handleSave}>
          <AppIcon name="check" className="button-icon" />
          Save
        </button>
        <button
          className="ghost-button"
          type="button"
          disabled={isTesting}
          onClick={() => void handleTest()}
        >
          <AppIcon name="spark" className="button-icon" />
          {isTesting ? 'Testing' : 'Test'}
        </button>
      </div>

      {visibleEndpoint.savedBaseUrl ? (
        <button
          className="ghost-button ghost-button--inline"
          type="button"
          onClick={handleClear}
        >
          Clear saved endpoint
        </button>
      ) : null}

        {statusMessage ? (
          <p
            className={`ollama-endpoint-control__status${
              statusTone ? ` ollama-endpoint-control__status--${statusTone}` : ''
            }`}
          >
            {statusMessage}
          </p>
        ) : null}
      </div>
    </details>
  )
}
