'use client';

type Props = {
  className?: string;
};

export function PortfolioPanel({ className }: Props) {
  return (
    <section
      className={
        'flex h-full w-full items-center justify-center bg-[#0A1020] ' +
        (className ?? '')
      }
      aria-label="Portfolio"
    >
      <p className="text-sm text-[#5F6B7A]">Coming soon — Prompt 5/6</p>
    </section>
  );
}
