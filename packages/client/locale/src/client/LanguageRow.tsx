/**
 * Language preference row registered into the General section item slot
 * (figma 501:30011 'Setting-Cell'): the ordered language stack. The head of
 * the list is the language on screen; every later entry answers the keys the
 * earlier ones lack. Registered by this package — the locale feature owns its
 * own settings surface.
 */
import { useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, IconPlusOutlineRegular, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createLanguageRowStore } from './settings-store.ts'
import css from './LanguageRow.module.css'

/** Injected business face: preference writes (t rides the standard locale seat). */
export interface LanguageRowInjected {
  /** Switch the active locale to one id, keeping the rest of the stack behind it. */
  setLocale: (id: string) => void
  /** Replace the whole ordered stack, most preferred first. */
  setLanguages: (ids: readonly string[]) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type LanguageRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createLanguageRowStore>>
  & PropsLocale<'settings.locale'> & LanguageRowInjected

/**
 * Render the Language row as an ordered, priority-editable list.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function LanguageRow({ t, setLanguages, useStore }: LanguageRowComponentProps) {
  const stack = useStore(s => s.stack)
  const options = useStore(s => s.options)
  const [open, setOpen] = useState(false)
  // A stored entry can name a language whose pack is gone: it stays listed
  // (and removable) under its raw id rather than disappearing silently.
  const labelOf = (id: string): string => options.find(option => option.id === id)?.label ?? id
  const installed = (id: string): boolean => options.some(option => option.id === id)
  const available = options.filter(option => !stack.includes(option.id))
  const move = (from: number, to: number): void => {
    const next = [...stack]
    next.splice(to, 0, ...next.splice(from, 1))
    setLanguages(next)
  }

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('language.title')}</div>
        <div className={css.hint}>{t('language.hint')}</div>
      </div>
      <div className={css.stack}>
        {stack.length === 0
          ? <div className={css.empty}>{t('language.empty')}</div>
          : (
            <ol className={css.list}>
              {stack.map((id, index) => (
                <li key={id} className={css.item}>
                  <span className={css.priority} aria-hidden="true">{index + 1}</span>
                  <span className={css.label}>{labelOf(id)}</span>
                  {installed(id) ? null : <span className={css.unavailable}>{t('language.unavailable')}</span>}
                  <button
                    type="button"
                    className={css.control}
                    aria-label={`${t('language.moveUp')} ${labelOf(id)}`}
                    disabled={index === 0}
                    onClick={() => { move(index, index - 1) }}
                  >
                    <IconChevronUpOutlineRegular />
                  </button>
                  <button
                    type="button"
                    className={css.control}
                    aria-label={`${t('language.moveDown')} ${labelOf(id)}`}
                    disabled={index === stack.length - 1}
                    onClick={() => { move(index, index + 1) }}
                  >
                    <IconChevronDownOutlineRegular />
                  </button>
                  <button
                    type="button"
                    className={css.control}
                    aria-label={`${t('language.remove')} ${labelOf(id)}`}
                    onClick={() => { setLanguages(stack.filter(entry => entry !== id)) }}
                  >
                    <IconCloseOutlineRegular />
                  </button>
                </li>
              ))}
            </ol>
          )}
        <Menu
          open={open}
          onClose={() => { setOpen(false) }}
          items={available.map(option => ({ id: option.id, label: option.label }))}
          onSelect={(id) => {
            setLanguages([...stack, id])
            setOpen(false)
          }}
          align="end"
          portal
          anchor={(
            <button
              type="button"
              className={css.add}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => { setOpen(v => !v) }}
            >
              <IconPlusOutlineRegular className={css.plus} />
              {t('language.add')}
            </button>
          )}
        />
      </div>
    </div>
  )
}
