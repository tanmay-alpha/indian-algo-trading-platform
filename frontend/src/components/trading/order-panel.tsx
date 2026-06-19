import { useEffect, useState } from "react";

function fmtINR(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function OrderPanel({ symbol, price }: { symbol: string; price: number }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState<number>(1);
  const [limit, setLimit] = useState<string>(price.toFixed(2));
  const [type, setType] = useState<"MKT" | "LMT" | "SL">("LMT");

  // When the parent passes a new symbol/price (live tick or watchlist switch),
  // resync the limit field. Previously the limit was only seeded at mount, so
  // switching symbol left a stale price sitting in the order ticket.
  useEffect(() => {
    setLimit(price.toFixed(2));
  }, [price, symbol]);

  // Guard against NaN/0 qty. `+e.target.value` returns NaN on cleared input;
  // before this fix `qty * price * 0.2` rendered as "₹NaN" and a NaN order
  // would have been accepted by the (future) submit handler.
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const margin = safeQty * safePrice * 0.2;
  const charges = safeQty * safePrice * 0.0005;
  const canSubmit = safeQty > 0 && safePrice > 0;

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Order</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <div className="font-semibold">{symbol}</div>
          <div className="font-mono tabular text-xs text-muted-foreground">{safePrice.toFixed(2)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 p-2">
        <button onClick={() => setSide("BUY")} className={`rounded px-3 py-2 text-xs font-semibold transition ${side === "BUY" ? "bg-bull text-white" : "bg-panel-elevated text-muted-foreground hover:text-foreground"}`}>BUY</button>
        <button onClick={() => setSide("SELL")} className={`rounded px-3 py-2 text-xs font-semibold transition ${side === "SELL" ? "bg-bear text-white" : "bg-panel-elevated text-muted-foreground hover:text-foreground"}`}>SELL</button>
      </div>
      <div className="space-y-2 px-3 pb-3 text-xs">
        <div className="flex gap-1">
          {(["MKT", "LMT", "SL"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 rounded border px-2 py-1 ${type === t ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
        <label className="block">
          <span className="text-muted-foreground">Quantity</span>
          <input
            type="number"
            min={0}
            value={Number.isFinite(qty) ? qty : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setQty(NaN);
                return;
              }
              const n = Number(raw);
              setQty(Number.isFinite(n) ? n : NaN);
            }}
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono tabular outline-none focus:border-primary"
          />
        </label>
        {type !== "MKT" && (
          <label className="block">
            <span className="text-muted-foreground">Price</span>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono tabular outline-none focus:border-primary"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
          <div className="rounded bg-panel-elevated px-2 py-1.5">
            <div>Margin</div>
            <div className="font-mono tabular text-foreground">{fmtINR(margin, 0)}</div>
          </div>
          <div className="rounded bg-panel-elevated px-2 py-1.5">
            <div>Charges</div>
            <div className="font-mono tabular text-foreground">{fmtINR(charges, 2)}</div>
          </div>
        </div>
        <button
          disabled={!canSubmit}
          className={`w-full rounded py-2.5 text-sm font-semibold text-white transition ${side === "BUY" ? "bg-bull hover:opacity-90" : "bg-bear hover:opacity-90"} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Place {side} order
        </button>
      </div>
      <div className="mt-auto border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex justify-between"><span>Available</span><span className="font-mono tabular text-foreground">₹2,48,532</span></div>
        <div className="flex justify-between"><span>Used margin</span><span className="font-mono tabular text-foreground">₹1,12,840</span></div>
      </div>
    </div>
  );
}
