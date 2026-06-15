// Shared keyframes used by Strategy / Backtest / Portfolio / AI panels
// for skeleton pulses and the AI typing indicator. Defined as a global style
// so multiple panels on the same page can share the same animation names
// without conflicting.
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
      @keyframes aiDotPulse {
        0%,
        100% {
          opacity: 0.25;
          transform: scale(0.85);
        }
        50% {
          opacity: 1;
          transform: scale(1);
        }
      }
    `}</style>
  );
}
