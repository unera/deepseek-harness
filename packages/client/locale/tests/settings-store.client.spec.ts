/** Language row store: snapshot-mirror action and the revision guard. */
import { describe, expect, it } from 'vitest'
import { createLanguageRowStore } from '../src/client/settings-store.ts'

const OPTIONS = [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }]
const STACK = ['zh', 'en']

describe('createLanguageRowStore', () => {
  it('init shape: empty mirror with revision at -1', () => {
    const store = createLanguageRowStore().create()
    expect(store.getSnapshot()).toEqual({ active: '', stack: [], options: [], revision: -1 })
  })

  it('sync mirrors the snapshot and advances the revision', () => {
    const store = createLanguageRowStore().create()
    store.actions.sync('zh', OPTIONS, STACK, 0)
    expect(store.getSnapshot()).toEqual({ active: 'zh', stack: STACK, options: OPTIONS, revision: 0 })
    store.actions.sync('en', OPTIONS, ['en'], 1)
    expect(store.getSnapshot().active).toBe('en')
    expect(store.getSnapshot().stack).toEqual(['en'])
    expect(store.getSnapshot().revision).toBe(1)
  })

  it('detaches the mirrored order from the caller', () => {
    const store = createLanguageRowStore().create()
    const stack = [...STACK]
    store.actions.sync('zh', OPTIONS, stack, 0)
    stack.push('ja')
    expect(store.getSnapshot().stack).toEqual(STACK)
  })

  it('revision guard drops stale and duplicate writes', () => {
    const store = createLanguageRowStore().create()
    store.actions.sync('en', OPTIONS, ['en'], 5)
    store.actions.sync('zh', OPTIONS, STACK, 4)
    store.actions.sync('zh', OPTIONS, STACK, 5)
    expect(store.getSnapshot().active).toBe('en')
    expect(store.getSnapshot().stack).toEqual(['en'])
    expect(store.getSnapshot().revision).toBe(5)
  })
})
