/** Host registration for the browser locale preference. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Volatile, Context } from '@deepseek-ai/cordis'

import z from '@deepseek-ai/schemastery'
import { LOCALE_PREFERENCE_FIELD, LOCALE_STACK_FIELD } from './locale-settings.ts'

import { LocaleSettingsFields } from './locale-settings.ts'

export {
  LOCALE_IDS, LOCALE_PREFERENCE_FIELD, LOCALE_SETTINGS_NAMESPACE, LOCALE_STACK_FIELD, LOCALE_STACK_MAX_LENGTH,
  assertLocaleStack, mergeLocaleSelection,
  type BuiltInLocaleId, type LocaleId, type LocaleSettings,
} from './locale-settings.ts'

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Explicit locale; omission follows the browser. */
  preference: Volatile<string | undefined>
  /** Ordered language stack; omission (or an empty list) keeps the single-id behaviour. */
  languages: Volatile<string[] | undefined>
}

/** Live preferences projected to the browser. */
export const Config = z.object({
  [LOCALE_PREFERENCE_FIELD]: LocaleSettingsFields[LOCALE_PREFERENCE_FIELD].volatile(),
  [LOCALE_STACK_FIELD]: LocaleSettingsFields[LOCALE_STACK_FIELD].volatile(),
})

/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
