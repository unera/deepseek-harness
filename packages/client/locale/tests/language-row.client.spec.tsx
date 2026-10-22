// @vitest-environment jsdom
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { allowAllAccess, bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { LanguageRow } from '../src/client/LanguageRow.tsx'
import type { LanguageRowComponentProps } from '../src/client/LanguageRow.tsx'
import { createLanguageRowStore } from '../src/client/settings-store.ts'

// Every fixture carries the resource hook the resources plugin merges into GlobalStandardProps.
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })

afterEach(cleanup)

const OPTIONS = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ru', label: 'Русский' },
  { id: 'pt-BR', label: 'Português (Brasil)' },
]

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceSnapshot>({
    items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  })
  return bindSnapshotSelector(store)
}

type AttentionSnapshot = Parameters<Parameters<LanguageRowComponentProps['useSessionStatus']>[0]>[0]
const noAttention: AttentionSnapshot = new Map()
const useSessionStatus: LanguageRowComponentProps['useSessionStatus'] = selector => selector(noAttention)

function mount(stack: readonly string[], active = stack[0] ?? 'zh', options = OPTIONS) {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createLanguageRowStore().create()
  store.actions.sync(active, options, stack, 0)
  const setLocale = vi.fn()
  const setLanguages = vi.fn()
  const props: LanguageRowComponentProps = {
    useSessions: emptySessions(),
    useSessionStatus,
    usePanelInfo, useSessionRetainInfo: () => undefined, useResource,
    useWorkspaces: emptyWorkspaces(),
    ...allowAllAccess,
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => key,
    setLocale,
    setLanguages,
  }
  render(<LanguageRow {...props} />)
  return { store, setLocale, setLanguages }
}

/** Read the rendered priority list as `[position, label]` pairs. */
function listLabels(): string[] {
  return screen.getAllByRole('listitem').map(item => item.querySelector('span:nth-child(2)')?.textContent ?? '')
}

describe('LanguageRow', () => {
  it('lists the stack in priority order under the row title', () => {
    mount(['zh', 'en', 'ja'])
    expect(screen.getByText('language.title')).toBeDefined()
    expect(screen.getByText('language.hint')).toBeDefined()
    expect(listLabels()).toEqual(['中文', 'English', '日本語'])
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toHaveLength(3)
    expect(screen.getAllByRole('listitem')[0]!.textContent).toContain('1')
  })

  it('shows the browser-following state when the stack is empty', () => {
    mount([])
    expect(screen.getByText('language.empty')).toBeDefined()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('offers only languages the catalog has, and appends the picked one last', () => {
    const b = mount(['zh', 'en'])
    const trigger = screen.getByRole('button', { name: 'language.add' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    // zh and en are already ranked; the three others are the candidates.
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['日本語', 'Русский', 'Português (Brasil)'])
    fireEvent.click(screen.getByRole('menuitem', { name: '日本語' }))
    expect(b.setLanguages).toHaveBeenCalledWith(['zh', 'en', 'ja'])
    // The picker closes on selection, like the former selector menu.
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('closes the picker on outside pointerdown without writing', () => {
    const b = mount(['zh'])
    fireEvent.click(screen.getByRole('button', { name: 'language.add' }))
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    fireEvent.pointerDown(document.body)
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(b.setLanguages).not.toHaveBeenCalled()
  })

  it('moves an entry up and down, without offering a move past either end', () => {
    const b = mount(['zh', 'en', 'ja'])
    // The head cannot move up and the tail cannot move down.
    expect(screen.getByRole('button', { name: 'language.moveUp 中文' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'language.moveDown 日本語' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'language.moveDown 中文' }))
    expect(b.setLanguages).toHaveBeenLastCalledWith(['en', 'zh', 'ja'])
    fireEvent.click(screen.getByRole('button', { name: 'language.moveUp 日本語' }))
    expect(b.setLanguages).toHaveBeenLastCalledWith(['zh', 'ja', 'en'])
  })

  it('removes one language and keeps the rest of the order', () => {
    const b = mount(['zh', 'en', 'ja'])
    fireEvent.click(screen.getByRole('button', { name: 'language.remove English' }))
    expect(b.setLanguages).toHaveBeenCalledWith(['zh', 'ja'])
  })

  it('keeps a stored language whose pack is gone, marked as not installed', () => {
    const b = mount(['fr', 'en'])
    // No label and no pack entry: the raw id stands in, so it can be removed.
    expect(listLabels()).toEqual(['fr', 'English'])
    expect(screen.getByText('language.unavailable')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'language.remove fr' }))
    expect(b.setLanguages).toHaveBeenCalledWith(['en'])
  })

  it('follows store changes and stays usable with the whole five-language stack', () => {
    const b = mount(['zh', 'en'])
    const five = OPTIONS.map(option => option.id)
    act(() => { b.store.actions.sync('pt-BR', OPTIONS, five, 1) })
    expect(listLabels()).toEqual(['中文', 'English', '日本語', 'Русский', 'Português (Brasil)'])
    expect(screen.getByRole('button', { name: 'language.moveUp Português (Brasil)' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'language.moveDown Português (Brasil)' })).toHaveProperty('disabled', true)
    // Every catalog language is ranked, so the picker has nothing to offer.
    fireEvent.click(screen.getByRole('button', { name: 'language.add' }))
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })
})
