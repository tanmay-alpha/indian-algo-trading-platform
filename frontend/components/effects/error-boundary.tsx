'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  boundaryName?: string
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.boundaryName ?? 'ErrorBoundary'}]`, error, errorInfo)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="grid min-h-[220px] place-items-center rounded-[var(--radius-md)] border border-[var(--border-2)] bg-[var(--bg-panel)] p-6 text-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--warn)]">
            {this.props.boundaryName ?? 'Screen'} unavailable
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-2)]">
            This panel hit a rendering error. The rest of MAET Terminal remains available.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 rounded-[var(--radius-md)] border border-[var(--neutral)] bg-[var(--neutral-dim)] px-3 py-2 font-mono text-xs font-bold text-[var(--neutral)]"
          >
            Retry panel
          </button>
        </div>
      </div>
    )
  }
}
