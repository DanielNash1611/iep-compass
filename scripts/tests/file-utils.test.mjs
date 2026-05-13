import test from 'node:test'
import assert from 'node:assert/strict'

import {
  revokeAttachmentPreview,
} from '../../src/features/upload/fileUtils.ts'

test('revokeAttachmentPreview does not revoke static demo preview URLs', () => {
  const originalRevoke = URL.revokeObjectURL
  const revokedUrls = []

  URL.revokeObjectURL = (url) => {
    revokedUrls.push(url)
  }

  try {
    revokeAttachmentPreview({
      previewUrl: '/demo/jordan-accommodation-snapshot.jpg',
      previewUrlIsStatic: true,
    })
    revokeAttachmentPreview({
      previewUrl: 'blob:http://localhost/preview',
      previewUrlIsStatic: false,
    })
  } finally {
    URL.revokeObjectURL = originalRevoke
  }

  assert.deepEqual(revokedUrls, ['blob:http://localhost/preview'])
})
