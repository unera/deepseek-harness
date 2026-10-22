/** `settings.locale` namespace dictionaries (the Language row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'language.title': '语言',
  'language.hint': '按优先顺序排列，靠前的语言优先显示，缺失的文案由后面的语言补上。',
  'language.add': '添加语言',
  'language.empty': '跟随浏览器语言',
  'language.unavailable': '未安装',
  'language.moveUp': '上移',
  'language.moveDown': '下移',
  'language.remove': '移除',
} satisfies Record<string, string>

/** The settings.locale namespace key union. */
export type SettingsLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'language.title': 'Language',
  'language.hint': 'Earlier languages win; missing text is filled by the ones after them.',
  'language.add': 'Add language',
  'language.empty': 'Follows the browser language',
  'language.unavailable': 'Not installed',
  'language.moveUp': 'Move up',
  'language.moveDown': 'Move down',
  'language.remove': 'Remove',
} satisfies Record<SettingsLocaleKey, string>
