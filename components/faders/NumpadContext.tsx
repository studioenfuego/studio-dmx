"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface NumpadOptions {
  min?: number;
  max?: number;
  unit?: string;
  maxDigits?: number;
}

interface Session {
  id: symbol;
  display: string;
  firstInput: boolean;
  onCommit: (val: number) => void;
  min: number;
  max: number;
  unit: string;
  maxDigits: number;
}

interface NumpadContextType {
  open: (id: symbol, initial: number, onCommit: (val: number) => void, options?: NumpadOptions) => void;
  session: Session | null;
}

const NumpadContext = createContext<NumpadContextType | null>(null);

export function useNumpad() {
  return useContext(NumpadContext);
}

export function NumpadProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const open = useCallback((
    id: symbol,
    initial: number,
    onCommit: (val: number) => void,
    options: NumpadOptions = {}
  ) => {
    const min = options.min ?? 0;
    const max = options.max ?? 100;
    const unit = options.unit ?? "%";
    const maxDigits = options.maxDigits ?? 3;
    setSession({ id, display: String(Math.round(initial)), firstInput: true, onCommit, min, max, unit, maxDigits });
  }, []);

  const digit = (d: string) => setSession((s) => {
    if (!s) return s;
    if (s.firstInput) return { ...s, display: d === "0" ? "0" : d, firstInput: false };
    if (s.display === "0" && d === "0") return s;
    if (s.display.length >= s.maxDigits) return s;
    const next = s.display === "0" ? d : s.display + d;
    if (parseInt(next) > s.max) return s;
    return { ...s, display: next };
  });

  const backspace = () => setSession((s) => {
    if (!s) return s;
    if (s.firstInput || s.display.length <= 1) return { ...s, display: "0", firstInput: false };
    return { ...s, display: s.display.slice(0, -1) };
  });

  const commit = () => {
    if (!session) return;
    const n = parseInt(session.display);
    session.onCommit(isNaN(n) ? session.min : Math.max(session.min, Math.min(session.max, n)));
    setSession(null);
  };

  const cancel = () => setSession(null);

  return (
    <NumpadContext.Provider value={{ open, session }}>
      {children}
      {session && (
        <>
          <div className="fixed inset-0 z-40" onClick={cancel} />

          <div
            className="fixed z-50 bottom-4 left-20 bg-card border border-border rounded-2xl shadow-2xl p-3 select-none"
            style={{ width: 216 }}
          >
            <div className="flex items-baseline justify-end gap-1 bg-muted rounded-xl px-3 py-2 mb-3">
              <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
                {session.display || "0"}
              </span>
              <span className="font-mono text-lg text-muted-foreground">{session.unit}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onPointerDown={(e) => { e.preventDefault(); digit(String(n)); }}
                  className="h-12 rounded-xl bg-muted hover:bg-accent active:scale-95 text-foreground font-mono text-xl font-semibold transition-all"
                >
                  {n}
                </button>
              ))}
              <button
                onPointerDown={(e) => { e.preventDefault(); backspace(); }}
                className="h-12 rounded-xl bg-muted hover:bg-accent active:scale-95 text-muted-foreground text-xl transition-all"
              >
                ⌫
              </button>
              <button
                onPointerDown={(e) => { e.preventDefault(); digit("0"); }}
                className="h-12 rounded-xl bg-muted hover:bg-accent active:scale-95 text-foreground font-mono text-xl font-semibold transition-all"
              >
                0
              </button>
              <button
                onPointerDown={(e) => { e.preventDefault(); commit(); }}
                className="h-12 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground text-xl font-bold transition-all"
              >
                ✓
              </button>
            </div>
          </div>
        </>
      )}
    </NumpadContext.Provider>
  );
}
