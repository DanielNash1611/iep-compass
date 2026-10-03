import { useEffect, useRef } from 'react'
import { analytics } from './index'
import { mountPrivacyControl } from './browser.js'

export function PrivacyControl() {
  const element = useRef<HTMLParagraphElement>(null)
  useEffect(() => { mountPrivacyControl(element.current, analytics) }, [])
  return <p ref={element} hidden style={{fontSize: '.75rem', padding: '.75rem 1rem', textAlign: 'center'}} />
}
