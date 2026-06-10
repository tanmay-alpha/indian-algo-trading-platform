import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductRiskFooter } from './ProductRiskFooter'

describe('ProductRiskFooter', () => {
  it('shows the user-facing compliance disclaimer', () => {
    render(<ProductRiskFooter />)

    expect(screen.getByText(/paper-mode research workspace/i)).toBeInTheDocument()
    expect(screen.getByText(/not sebi registered/i)).toBeInTheDocument()
    expect(screen.getByText(/no real-money orders/i)).toBeInTheDocument()
  })
})
