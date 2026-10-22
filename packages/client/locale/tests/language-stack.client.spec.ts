/**
 * Ordered language stack: the durable preference model, the precedence rule
 * between the user stack and a declared per-language fallback, and resolution
 * through a stack that spans several dictionaries.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { stubConfigForm, type StubConfigForm } from '@deepseek-ai/dsh-client-test-runtime'
import type { LocaleSnapshot } from '@deepseek-ai/dsh-client-locale/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import {
  LOCALE_STACK_MAX_LENGTH, LocaleSettingsSchema, assertLocaleStack, mergeLocaleSelection,
  type LocaleSettings,
} from '../src/locale-settings.ts'

const make = (host?: StubConfigForm<LocaleSettings>): {
  ctx: Context
  svc: LocaleRuntime
  events: LocaleSnapshot[]
} => {
  const ctx = new Context()
  const events: LocaleSnapshot[] = []
  ctx.on('locale/change', (snapshot) => { events.push(snapshot) })
  return { ctx, svc: new LocaleRuntime(ctx, host?.scope), events }
}

/** Pin the browser language a fresh service reads unless a selection overrides it. */
const stubLanguages = (...tags: string[]): void => {
  vi.stubGlobal('navigator', { languages: tags, language: tags[0] ?? '' })
}

/** Catalog ids used by the over-limit cases (every entry well-formed and unique). */
const MANY_LANGUAGES = ['ru', 'en', 'zh', 'ja', 'fr', 'de', 'pt', 'it', 'es']

describe('durable locale schema', () => {
  it('keeps a preference-only document valid: it is a stack of one', () => {
    // The array field normalizes absence to []; the reader treats an empty
    // stack exactly like a missing one, so this stays a stack of one.
    expect(LocaleSettingsSchema({ preference: 'ru' })).toEqual({ preference: 'ru', languages: [] })
    expect(LocaleSettingsSchema({})).toEqual({ languages: [] })
  })

  it('accepts an ordered stack beside the legacy field', () => {
    expect(LocaleSettingsSchema({ preference: 'ru', languages: ['ru', 'en', 'zh'] }))
      .toEqual({ preference: 'ru', languages: ['ru', 'en', 'zh'] })
    // An entry no catalog hosts is a document the schema cannot judge.
    expect(LocaleSettingsSchema({ languages: ['xx', 'en'] })).toEqual({ languages: ['xx', 'en'] })
  })

  it('rejects malformed and over-long stacks', () => {
    expect(() => LocaleSettingsSchema({ languages: ['bad locale'] })).toThrow()
    expect(() => LocaleSettingsSchema({ languages: MANY_LANGUAGES })).toThrow()
  })
})

describe('assertLocaleStack', () => {
  it('returns a frozen copy of a unique, well-formed stack', () => {
    const stack = assertLocaleStack(['ru', 'en'])
    expect(stack).toEqual(['ru', 'en'])
    expect(Object.isFrozen(stack)).toBe(true)
  })

  it('rejects malformed ids, case-insensitive repeats, and over-long stacks', () => {
    expect(() => assertLocaleStack(['bad locale'])).toThrow('not a BCP 47-style tag')
    expect(() => assertLocaleStack(['ru', 'RU'])).toThrow('repeats')
    expect(() => assertLocaleStack(MANY_LANGUAGES)).toThrow(`at most ${LOCALE_STACK_MAX_LENGTH}`)
  })
})

describe('mergeLocaleSelection', () => {
  it('treats a preference-only section as a stack of one', () => {
    expect(mergeLocaleSelection('ja', undefined)).toEqual(['ja'])
  })

  it('carries a stored stack without any primary', () => {
    expect(mergeLocaleSelection(undefined, ['ru', 'en'])).toEqual(['ru', 'en'])
  })

  it('heads the stored stack with the primary and drops the repeat', () => {
    expect(mergeLocaleSelection('en', ['zh', 'en'])).toEqual(['en', 'zh'])
  })

  it('is empty when the document names nothing', () => {
    expect(mergeLocaleSelection(undefined, undefined)).toEqual([])
  })
})

describe('LocaleRuntime language stack', () => {
  beforeEach(() => {
    // A Chinese browser is the baseline these specs assert their zh state on.
    stubLanguages('zh-CN')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('walks the stack in order and lets it beat a declared fallback', () => {
    const { svc } = make()
    svc.register('ns', 'en', { hello: 'Hello', onlyEn: 'English only' })
    svc.register('ns', 'zh', { hello: '你好' })
    // Japanese declares English as its own fallback, but the user put Chinese
    // behind it: the stack decides, and ja's registration does not.
    svc.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })
    svc.register('ns', 'ja', {})
    svc.setLanguages(['ja', 'zh'])
    expect(svc.getLocale().active).toBe('ja')
    expect(svc.getLocale().stack).toEqual(['ja', 'zh'])
    expect(svc.bind('ns')('hello')).toBe('你好')
    // A declared fallback still answers for a language the stack does not
    // contain, which is how the terminal English dictionary stays reachable.
    expect(svc.bind('ns')('onlyEn')).toBe('English only')
  })

  it('resolves a key the first stack language lacks from the next one', () => {
    const { svc } = make()
    svc.register('ns', 'ru', { greet: 'Привет' })
    svc.register('ns', 'en', { greet: 'Hello', bye: 'Bye' })
    svc.register('ns', 'zh', { bye: '再见', cya: '回见' })
    svc.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' })
    svc.setLanguages(['ru', 'en', 'zh'])
    const t = svc.bind('ns')
    expect(t('greet')).toBe('Привет')
    expect(t('bye')).toBe('Bye')
    expect(t('cya')).toBe('回见')
    // Nothing in the stack carries this key: the source literal is the last resort.
    expect(t('还没翻译')).toBe('还没翻译')
  })

  it('skips a stack entry whose language pack is not installed', () => {
    const host = stubConfigForm<LocaleSettings>()
    const { svc } = make(host)
    host.publish({
      status: 'ready', value: { preference: 'fr', languages: ['fr', 'en'] }, revision: 1, writable: true,
    })
    // The stored id survives — the list keeps it for later removal — but it
    // cannot decide the active language while nothing serves it.
    expect(svc.getLocale().stack).toEqual(['fr', 'en'])
    expect(svc.getLocale().active).toBe('en')
    svc.register('ns', 'en', { k: 'English' })
    svc.addLanguage({ id: 'fr', label: 'Français', fallback: 'en' })
    expect(svc.getLocale().active).toBe('fr')
    expect(svc.bind('ns')('k')).toBe('English')
  })

  it('reorders resolution when the stack moves', () => {
    const host = stubConfigForm<LocaleSettings>()
    const { svc, events } = make(host)
    svc.register('ns', 'zh', { k: '中文' })
    svc.register('ns', 'en', { k: 'English' })
    svc.setLanguages(['en', 'zh'])
    expect(svc.getLocale().active).toBe('en')
    expect(svc.bind('ns')('k')).toBe('English')
    svc.setLanguages(['zh', 'en'])
    expect(svc.getLocale().active).toBe('zh')
    expect(svc.bind('ns')('k')).toBe('中文')
    expect(svc.getLocale().stack).toEqual(['zh', 'en'])
    expect(events.map(snapshot => snapshot.active)).toEqual(['en', 'zh'])
    // The whole stack is durable, and the legacy head field follows it.
    expect(host.set).toHaveBeenCalledWith('languages', ['en', 'zh'])
    expect(host.set).toHaveBeenCalledWith('languages', ['zh', 'en'])
    // The legacy head field trails the stack on every write.
    expect(host.set).toHaveBeenCalledWith('preference', 'zh')
  })

  it('clears an empty stack back to the browser-derived locale', () => {
    const host = stubConfigForm<LocaleSettings>()
    const { svc } = make(host)
    svc.setLanguages(['en'])
    svc.setLanguages([])
    expect(svc.getLocale().active).toBe('zh')
    expect(svc.getLocale().stack).toEqual([])
    expect(host.set).toHaveBeenLastCalledWith('languages', [])
    expect(host.unset).toHaveBeenCalledWith('preference')
  })

  it('rejects a malformed, repeated, or over-long stack without touching the selection', () => {
    const { svc } = make()
    const before = svc.getLocale()
    expect(() => { svc.setLanguages(['ru', 'RU']) }).toThrow('repeats')
    expect(() => { svc.setLanguages(['bad locale']) }).toThrow('not a BCP 47-style tag')
    expect(() => { svc.setLanguages(MANY_LANGUAGES) }).toThrow('at most')
    expect(svc.getLocale()).toBe(before)
  })

  it('leaves the single-language path exactly as it was', () => {
    const host = stubConfigForm<LocaleSettings>()
    const { svc } = make(host)
    svc.register('ns', 'en', { base: 'English' })
    svc.register('ns', 'ja', { own: 'こんにちは' })
    svc.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })
    svc.setLocale('ja')
    expect(svc.getLocale().active).toBe('ja')
    // A single id is a stack of one — no order to persist, one durable field.
    expect(svc.getLocale().stack).toEqual(['ja'])
    expect(svc.bind('ns')('own')).toBe('こんにちは')
    expect(svc.bind('ns')('base')).toBe('English')
    expect(host.set).toHaveBeenCalledTimes(1)
    expect(host.set).toHaveBeenCalledWith('preference', 'ja')
  })

  it('replaces a stored order when a plugin names one language', () => {
    const host = stubConfigForm<LocaleSettings>()
    const { svc } = make(host)
    svc.setLanguages(['zh', 'en'])
    svc.setLocale('en')
    // One id is a stack of one: nothing stays behind it to answer its gaps.
    expect(svc.getLocale().stack).toEqual(['en'])
    expect(host.set).toHaveBeenLastCalledWith('preference', 'en')
    expect(host.set).toHaveBeenCalledWith('languages', ['en'])
  })

  it('migrates a preference-only document into a stack and back', () => {
    const host = stubConfigForm<LocaleSettings>()
    host.publish({ status: 'ready', value: { preference: 'en' }, revision: 1, writable: true })
    const { svc, events } = make(host)
    expect(svc.getLocale().stack).toEqual(['en'])
    expect(svc.getLocale().active).toBe('en')

    // Widening the preference writes the stack; the Host acceptance returns
    // with both fields, and the reader keeps the order it wrote.
    svc.setLanguages(['zh', 'en'])
    expect(host.set).toHaveBeenCalledWith('languages', ['zh', 'en'])
    host.publish({ value: { preference: 'zh', languages: ['zh', 'en'] }, revision: 2 })
    expect(svc.getLocale().active).toBe('zh')
    expect(svc.getLocale().stack).toEqual(['zh', 'en'])

    // Dropping the stack field leaves the legacy document, which collapses to
    // the single id without losing the selection.
    host.publish({ value: { preference: 'zh' }, revision: 3 })
    expect(svc.getLocale().active).toBe('zh')
    expect(svc.getLocale().stack).toEqual(['zh'])
    // en was adopted at construction (the browser names zh-CN), then the
    // widened stack took over; removing the stack field keeps zh.
    expect(events.map(snapshot => snapshot.active)).toEqual(['en', 'zh'])
  })

  it('adopts a reorder that keeps the head, and ignores a repeated order', () => {
    const host = stubConfigForm<LocaleSettings>()
    host.publish({ status: 'ready', value: { preference: 'en', languages: ['en', 'zh'] }, revision: 1, writable: true })
    const { svc, events } = make(host)
    const revision = svc.getLocale().revision
    const switched = events.length

    host.publish({ value: { preference: 'en', languages: ['en', 'zh'] }, revision: 2 })
    expect(svc.getLocale().revision).toBe(revision)

    host.publish({ value: { preference: 'en', languages: ['en', 'zh', 'ja'] }, revision: 3 })
    expect(svc.getLocale().stack).toEqual(['en', 'zh', 'ja'])
    expect(svc.getLocale().active).toBe('en')
    expect(svc.getLocale().revision).toBe(revision + 1)
    // A reorder is not a language switch: only the row mirror refreshes.
    expect(events).toHaveLength(switched)
  })
})
