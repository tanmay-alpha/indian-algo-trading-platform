'use client';

import { create } from 'zustand';

// Lightweight terminal-wide state. Right now it only carries the currently
// selected symbol so the AI panel can include it in chat context; expand as
// the terminal grows (active interval, selected strategy, etc.).
type TerminalState = {
  currentSymbol: string;
  setCurrentSymbol: (symbol: string) => void;
};

export const useTerminalStore = create<TerminalState>((set) => ({
  currentSymbol: '',
  setCurrentSymbol: (symbol) => set({ currentSymbol: symbol }),
}));
