// Shared keyframe used by Strategy + Backtest panels for skeleton pulses.
// Defined as a global style so multiple panels on the same page can share
// the same animation name without conflicting.
export function PanelPulseStyles() {
  return (
    <style jsx global>{`
      @keyframes panelPulse {
        0%,
        100% {
          opacity: 0.3;
        }
        50% {
          opacity: 0.7;
        }
      }
    `}</style>
  );
}
