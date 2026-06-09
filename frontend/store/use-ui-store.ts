import { useTerminalStore } from './terminal-store-core'
import type { TerminalStore } from './terminal-store-core'

export type UiStore = Pick<
  TerminalStore,
  | 'activeWorkspace'
  | 'activePreset'
  | 'rightPanelTab'
  | 'bottomDockTab'
  | 'bottomDockOpen'
  | 'commandPaletteOpen'
  | 'shortcutsOpen'
  | 'chartLayoutMode'
  | 'showPatternLabels'
  | 'setWorkspace'
  | 'setPreset'
  | 'setRightPanelTab'
  | 'setBottomDockTab'
  | 'setBottomDockOpen'
  | 'toggleCommandPalette'
  | 'toggleShortcuts'
  | 'setChartLayoutMode'
  | 'setShowPatternLabels'
>

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  return useTerminalStore(selector as (state: TerminalStore) => T)
}
