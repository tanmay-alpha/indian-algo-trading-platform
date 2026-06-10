interface ProductRiskFooterProps {
  compact?: boolean
}

export function ProductRiskFooter({ compact = false }: ProductRiskFooterProps) {
  return (
    <div
      className={[
        'border-t border-border bg-base font-mono text-[10px] leading-5 text-text-hint',
        compact ? 'px-3 py-1 text-center' : 'px-6 py-3 text-center',
      ].join(' ')}
    >
      MAET Terminal is a paper-mode research workspace. Not SEBI registered. No financial advice.
      No real-money orders are placed from this deployment.
    </div>
  )
}
