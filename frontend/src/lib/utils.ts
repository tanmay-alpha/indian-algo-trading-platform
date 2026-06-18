import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Local-only helper preserved from the pre-MAET workspace.
 * Used by src/store/terminal-store-core.ts and src/components/ui-maet/toast.tsx.
 * Not part of the MAET ↔ Lovable parity contract.
 */
export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
