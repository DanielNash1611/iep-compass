import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGemmaDocumentPlan,
  getDocumentReadingStatusMessages,
} from '../../src/features/upload/documentReadingSupport.ts'
import {
  getAttachmentInterpretationAction,
} from '../../src/features/source/interpretationAvailability.ts'
import {
  createJordanDemoSources,
} from '../../src/data/demoCase.ts'

function buildPlan(overrides = {}) {
  return buildGemmaDocumentPlan({
    endpointBaseUrl: undefined,
    endpointIsRemote: false,
    primaryModel: 'gemma4:e2b',
    runtimeLabel: 'Unavailable',
    ...overrides,
  })
}

test('browser Gemma stays available for reviewed-text mapping', () => {
  const plan = buildPlan()

  assert.equal(plan.browserTextReasoning.supported, true)
  assert.match(plan.browserTextReasoning.detail, /reviewed-text mapping/i)
})

test('document reading is unavailable when browser image input is unsupported and no endpoint is configured', () => {
  const plan = buildPlan()

  assert.equal(plan.browserImageInterpretation.supported, false)
  assert.equal(plan.endpointFallback.configured, false)
  assert.equal(plan.configured, false)
  assert.equal(plan.imageInterpretationMode, 'unavailable')
  assert.match(plan.browserImageInterpretation.detail, /Gemma-3n/i)
})

test('configured endpoint remains a development fallback for document reading', () => {
  const plan = buildPlan({
    endpointBaseUrl: '/api/ollama',
    runtimeLabel: 'Configured route',
  })

  assert.equal(plan.browserImageInterpretation.supported, false)
  assert.equal(plan.endpointFallback.configured, true)
  assert.equal(plan.configured, true)
  assert.equal(plan.imageInterpretationMode, 'endpoint')
})

test('seeded demo image needs interpretation before the presentation flow can proceed without an endpoint', () => {
  const demo = createJordanDemoSources()
  const plan = buildPlan()
  const action = getAttachmentInterpretationAction(
    demo.taskSource.attachments[0],
    plan,
  )

  assert.equal(action.canInterpret, false)
  assert.equal(action.needsModel, false)
  assert.match(action.note, /Ollama backup is not configured/i)
})

test('configured Ollama endpoint restores demo image interpretation as a labeled backup', () => {
  const demo = createJordanDemoSources()
  const plan = buildPlan({
    endpointBaseUrl: '/api/ollama',
    runtimeLabel: 'Local Ollama',
  })
  const action = getAttachmentInterpretationAction(
    demo.taskSource.attachments[0],
    plan,
  )

  assert.equal(action.canInterpret, true)
  assert.equal(action.label, 'Interpret with Ollama backup')
  assert.match(action.note, /create a new review draft/i)
  assert.match(action.note, /stays as a reference/i)
})

test('unavailable document-reading copy does not ask users to tap an impossible interpret action', () => {
  const plan = buildPlan()
  const messages = getDocumentReadingStatusMessages(plan).join(' ')
  const demo = createJordanDemoSources()
  const action = getAttachmentInterpretationAction(
    {
      ...demo.taskSource.attachments[0],
      id: 'live-task-image',
      isDemoSeed: false,
      status: 'interpret_ready',
    },
    plan,
  )

  assert.doesNotMatch(messages, /tap interpret/i)
  assert.doesNotMatch(action.note ?? '', /tap interpret/i)
  assert.match(messages, /Browser Gemma image interpretation: not available/i)
  assert.match(messages, /Ollama backup/i)
  assert.match(action.note, /does not read images directly/i)
})
