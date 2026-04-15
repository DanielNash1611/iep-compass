import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike {
  abort: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: ((event: Event) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

let activeDictationStop: (() => void) | null = null

function getRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function toErrorMessage(error: string) {
  switch (error) {
    case 'audio-capture':
      return 'No microphone was detected. You can keep typing or paste the details instead.'
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow microphone permissions to use dictation.'
    case 'network':
      return 'Voice dictation could not connect right now. Try again or keep typing.'
    case 'no-speech':
      return 'No speech was detected. Try again when you are ready.'
    default:
      return 'Voice dictation stopped unexpectedly. You can try again or continue typing.'
  }
}

interface UseSpeechDictationOptions {
  lang?: string
  onTranscript: (transcript: string) => void
}

export function useSpeechDictation({
  lang = 'en-US',
  onTranscript,
}: UseSpeechDictationOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const clearListeningState = useCallback(() => {
    if (activeDictationStop === stop) {
      activeDictationStop = null
    }

    setIsListening(false)
  }, [stop])

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor()

    if (!Recognition) {
      setErrorMessage(
        'Voice dictation is not available in this browser. You can keep typing or paste the details instead.',
      )
      return
    }

    setErrorMessage(null)

    if (!recognitionRef.current) {
      const recognition = new Recognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        const finalTranscript = Array.from(
          { length: event.results.length - event.resultIndex },
          (_, offset) => event.results[event.resultIndex + offset],
        )
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript ?? '')
          .join(' ')
          .trim()

        if (finalTranscript) {
          onTranscriptRef.current(finalTranscript)
        }
      }
      recognition.onerror = (event) => {
        setErrorMessage(toErrorMessage(event.error))
      }
      recognition.onend = () => {
        clearListeningState()
      }
      recognitionRef.current = recognition
    }

    recognitionRef.current.lang = lang

    if (activeDictationStop && activeDictationStop !== stop) {
      activeDictationStop()
    }

    try {
      recognitionRef.current.start()
      activeDictationStop = stop
      setIsListening(true)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Voice dictation could not start. You can keep typing instead.',
      )
      clearListeningState()
    }
  }, [clearListeningState, lang, stop])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()

      if (activeDictationStop === stop) {
        activeDictationStop = null
      }
    }
  }, [stop])

  return {
    errorMessage,
    isListening,
    isSupported: Boolean(getRecognitionConstructor()),
    resetErrorMessage: () => setErrorMessage(null),
    start,
    stop,
  }
}
