export interface BrowserDocumentReadingCapability {
  detail: string
  label: string
  supported: boolean
}

export interface EndpointDocumentReadingCapability {
  configured: boolean
  detail: string
  isRemote: boolean
  primaryModel: string
  runtimeLabel: string
}

export interface GemmaDocumentPlan {
  browserImageInterpretation: BrowserDocumentReadingCapability
  browserTextReasoning: BrowserDocumentReadingCapability
  configured: boolean
  endpointFallback: EndpointDocumentReadingCapability
  imageInterpretationMode: 'browser' | 'endpoint' | 'unavailable'
  isRemote: boolean
  nativeAppNote: string
  primaryModel: string
  runtimeLabel: string
}

export const BROWSER_GEMMA_TEXT_REASONING_DETAIL =
  'Browser Gemma 4 E2B can run short reviewed-text mapping after the saved model passes the on-device gate.'

export const BROWSER_GEMMA_IMAGE_UNSUPPORTED_DETAIL =
  'The current MediaPipe web multimodal API documents image and audio prompting for Gemma-3n models. IEP Compass keeps the Gemma 4 E2B browser path text-only until Google documents the Gemma 4 E2B web task as an image-input path.'

export const NATIVE_IMAGE_INTERPRETATION_NOTE =
  'Fully private browser image interpretation still needs a documented Gemma 4 browser vision path; the intended production direction is native Android with Google AI Edge.'

export function buildGemmaDocumentPlan(input: {
  endpointBaseUrl?: string
  endpointIsRemote: boolean
  primaryModel: string
  runtimeLabel: string
}): GemmaDocumentPlan {
  const endpointConfigured = Boolean(input.endpointBaseUrl)
  const browserImageSupported = false
  const imageInterpretationMode = browserImageSupported
    ? 'browser'
    : endpointConfigured
      ? 'endpoint'
      : 'unavailable'

  return {
    browserImageInterpretation: {
      detail: BROWSER_GEMMA_IMAGE_UNSUPPORTED_DETAIL,
      label: 'Browser Gemma image interpretation',
      supported: browserImageSupported,
    },
    browserTextReasoning: {
      detail: BROWSER_GEMMA_TEXT_REASONING_DETAIL,
      label: 'Browser Gemma text reasoning',
      supported: true,
    },
    configured: browserImageSupported || endpointConfigured,
    endpointFallback: {
      configured: endpointConfigured,
      detail: endpointConfigured
        ? `The local Gemma image reader is configured through ${input.runtimeLabel}.`
        : 'No local document-reading endpoint is configured.',
      isRemote: input.endpointIsRemote,
      primaryModel: input.primaryModel,
      runtimeLabel: input.runtimeLabel,
    },
    imageInterpretationMode,
    isRemote: endpointConfigured && input.endpointIsRemote,
    nativeAppNote: NATIVE_IMAGE_INTERPRETATION_NOTE,
    primaryModel: input.primaryModel,
    runtimeLabel: browserImageSupported
      ? 'Browser on-device'
      : endpointConfigured
        ? input.runtimeLabel
        : 'Unavailable',
  }
}

export function getDocumentReadingStatusMessages(plan: GemmaDocumentPlan) {
  const messages = [
    `Browser Gemma 4 E2B handles reviewed-text mapping. Image reading uses the local Gemma image reader when configured.${
      plan.endpointFallback.configured
        ? ''
        : ' No local image reader is configured, so uploaded images stay as references until you paste the visible wording manually.'
    }`,
    `${plan.browserTextReasoning.label}: ${
      plan.browserTextReasoning.supported ? 'available for text mapping' : 'not available'
    }. ${plan.browserTextReasoning.detail}`,
    `${plan.browserImageInterpretation.label}: ${
      plan.browserImageInterpretation.supported ? 'available' : 'not available'
    }. ${plan.browserImageInterpretation.detail}`,
    `Local Gemma image reader: ${
      plan.endpointFallback.configured ? 'configured' : 'not configured'
    }. ${plan.endpointFallback.detail}`,
  ]

  if (!plan.browserImageInterpretation.supported) {
    messages.push(plan.nativeAppNote)
  }

  return messages
}
