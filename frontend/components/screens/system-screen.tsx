'use client'

import { JournalWorkspace } from '@/components/workspaces/workspace-content'
import { MobilePage } from '@/components/mobile/mobile-page'

export function SystemScreen() {
  return (
    <MobilePage className="flex flex-col h-full pb-24 space-y-4">
      {/* Symbol header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-3.5 rounded-2xl">
          <div>
            <h2 className="text-sm font-extrabold text-text tracking-wide leading-tight uppercase">
              System Telemetry
            </h2>
            <div className="text-[9px] text-text-faint font-semibold uppercase tracking-wider mt-1">
              Observability Journal &amp; Diagnostics
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
        <JournalWorkspace />
      </div>
    </MobilePage>
  )
}
