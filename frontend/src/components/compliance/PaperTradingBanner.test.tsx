import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PaperTradingBanner } from './PaperTradingBanner'

describe('PaperTradingBanner', () => {
  it('makes the terminal paper-only state visible', () => {
    render(<PaperTradingBanner />)

    expect(screen.getByText(/paper trading only/i)).toBeInTheDocument()
    expect(screen.getByText(/not sebi registered/i)).toBeInTheDocument()
  })
})
