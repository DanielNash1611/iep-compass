import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)

// Exercise the APIs used by each overridden consumer, including ESLint's partial
// directory traversal and TypeScript's optional default-project matching.
for (const consumer of ['eslint', '@eslint/config-array', '@typescript-eslint/typescript-estree']) {
  const glob = createRequire(require.resolve(consumer))('minimatch')
  test(`${consumer}: supported glob matching and bounded preprocessing`, () => {
    for (const [file, pattern, options, expected] of [
      ['src/view.tsx', '**/*.{ts,tsx}', { dot: true }, true],
      ['src/.hidden.ts', '**/*.{ts,tsx}', { dot: true }, true],
      ['src/view.js', '**/*.{ts,tsx}', { dot: true }, false],
      ['src/nested/view.ts', 'src/**/!(*.test).ts', {}, true],
      ['src/view.test.ts', 'src/**/!(*.test).ts', {}, false],
      ['dist/view.ts', '!dist/**', { flipNegate: true }, true],
      ['src/view.ts', '!dist/**', { flipNegate: true }, false],
    ]) {
      assert.equal(new glob.Minimatch(pattern, options).match(file), expected)
      assert.equal(glob.minimatch(file, pattern, options), expected)
    }
    const traversal = new glob.Minimatch('src/**/*.tsx', { dot: true })
    assert.equal(traversal.match('src/nested', true), true)
    assert.equal(traversal.match('other', true), false)
    // GHSA-g3hv-75wg-m249: optimization must respect the configured expansion
    // budget even when **/../ preprocessing creates alternatives.
    const bounded = new glob.Minimatch('**/../a/b/'.repeat(6) + 'x', {
      optimizationLevel: 2, braceExpandMax: 16,
    })
    assert.ok(bounded.globParts.length <= 16)
  })
}

test('ESLint still selects TypeScript sources and ignores build output', async () => {
  const { ESLint } = require('eslint')
  const eslint = new ESLint()
  assert.equal(await eslint.isPathIgnored('src/maintenance-check.tsx'), false)
  assert.equal(await eslint.isPathIgnored('src/.maintenance-check.tsx'), false)
  assert.equal(await eslint.isPathIgnored('dist/maintenance-check.tsx'), true)
})
