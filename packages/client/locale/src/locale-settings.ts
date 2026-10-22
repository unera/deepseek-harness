/** Locale preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the locale plugin. */
export const LOCALE_SETTINGS_NAMESPACE = 'locale'

/** Field carrying an explicit locale selection; absence delegates to the browser. */
export const LOCALE_PREFERENCE_FIELD = 'preference'

/** Field carrying the ordered language stack; its head is the primary language. */
export const LOCALE_STACK_FIELD = 'languages'

/** Longest preference stack the row offers (the control stays a list, not a catalogue). */
export const LOCALE_STACK_MAX_LENGTH = 8

/** Accepted BCP 47-style language ids. */
export const LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

/** Locale identifiers shipped by the browser client. */
export const LOCALE_IDS = ['zh', 'en'] as const

/** Locale identifier shipped by the browser client. */
export type BuiltInLocaleId = typeof LOCALE_IDS[number]

/** Open locale identifier accepted from language-pack plugins. */
export type LocaleId = string

/** Durable locale section shared by the Host schema and the browser scope. */
export interface LocaleSettings {
  /** Explicit locale selection; absence delegates to the browser. */
  preference?: LocaleId
  /**
   * Ordered language stack, most preferred first. Absent (or empty) keeps the
   * single-id behaviour: the selection is the {@link preference} field, or the
   * browser. Entries naming an unregistered language stay in the document and
   * are skipped at resolution, so a preference survives uninstalling a pack.
   */
  languages?: LocaleId[]
}

/**
 * Validate a language stack before it becomes a preference.
 *
 * A stack is a flat priority list, so the only cycle it could express is a
 * repeat; declared per-language fallbacks are cycle-checked at registration
 * (`addLanguage`) and followed behind a visited set at resolution, so no
 * combination can loop.
 * @param stack - candidate ids in priority order.
 * @returns a frozen copy, safe to store durably.
 * @throws when an id is malformed, a repeat is present (case-insensitively),
 * or the stack is longer than {@link LOCALE_STACK_MAX_LENGTH}.
 */
export function assertLocaleStack(stack: readonly LocaleId[]): readonly LocaleId[] {
  if (stack.length > LOCALE_STACK_MAX_LENGTH) {
    throw new RangeError(`locale stack carries at most ${LOCALE_STACK_MAX_LENGTH} languages, got ${stack.length}`)
  }
  const seen = new Set<string>()
  for (const id of stack) {
    if (!LOCALE_ID_PATTERN.test(id)) throw new Error(`locale id "${id}" is not a BCP 47-style tag`)
    const key = id.toLowerCase()
    if (seen.has(key)) throw new Error(`locale stack repeats "${id}"`)
    seen.add(key)
  }
  return Object.freeze([...stack])
}

/**
 * Merge the legacy single id with a stored stack into the effective order: an
 * explicit selection heads the list, the stored stack supplies the tail. Ids
 * are deduplicated case-insensitively, so a document that also names the
 * primary language inside `languages` still yields one entry per language.
 * @param preference - durable `locale.preference`, when the document has one.
 * @param languages - durable `locale.languages`, when the document has one.
 * @returns the effective ordered ids, unregistered ones included.
 */
export function mergeLocaleSelection(
  preference: LocaleId | undefined,
  languages: readonly LocaleId[] | undefined,
): readonly LocaleId[] {
  const ordered = preference === undefined ? languages ?? [] : [preference, ...languages ?? []]
  const merged: LocaleId[] = []
  const seen = new Set<string>()
  for (const id of ordered) {
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(id)
  }
  return Object.freeze(merged)
}

/** Durable locale schema; also the wire envelope the browser scope validates against. */
export const LocaleSettingsFields = {
  [LOCALE_PREFERENCE_FIELD]: z.string().pattern(LOCALE_ID_PATTERN).required(false),
  [LOCALE_STACK_FIELD]: z.array(z.string().pattern(LOCALE_ID_PATTERN))
    .max(LOCALE_STACK_MAX_LENGTH)
    .required(false),
}

/** Schema for the shared locale preference. */
export const LocaleSettingsSchema = z.object(LocaleSettingsFields)
