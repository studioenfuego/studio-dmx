"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface Session {
  id: symbol;
  display: string;
  firstInput: boolean;
  onCommit: (pct: number) => void;
}

interface NumpadContextType {
  open: (id: symbol, initial: number, onCommit: (pct: number) => void) => void;
  session: Session | null;
}

const NumpadContext = createContext<NumpadContextType | null>(null);

export function useNumpad() {
  return useContext(NumpadContext);
}

export function NumpadProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const open = useCallback((id: symbol, initial: number, onCommit: (pct: number) => void) => {
    setSession({ id, display: String(Math.round(initial)), firstInput: true, onCommit });
  }, []);

  const digit = (d: string) => setSession((s) => {
    if (!s) return s;
    if (s.firstInput) return { ...s, display: d, firstInput: false };
    if (s.display.length >= 3) return s;
    const next = s.display + d;
    if (parseInt(next) > 100) return s;
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
    session.onCommit(isNaN(n) ? 0 : Math.max(0, Math.min(100, n)));
    setSession(null);
  };

  const cancel = () => setSession(null);

  return (
    <NumpadContext.Provider value={{ open, session }}>
      {children}
      {session && (
        <>
          {/* Backdrop — dismiss on tap outside */}
          <div className="fixed inset-0 z-40" onClick={cancel} />

          {/* Numpad panel — bottom-left, clear of the right inspector */}
          <div
            className="fixed z-50 bottom-4 left-20 bg-card border border-border rounded-2xl shadow-2xl p-3 select-none"
            style={{ width: 216 }}
          >
            {/* Value display */}
            <div className="flex items-baseline justify-end gap-1 bg-muted rounded-xl px-3 py-2 mb-3">
              <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
                {session.display || "0"}
              </span>
              <span className="font-mono text-lg text-muted-foreground">%</span>
            </div>

            {/* Button grid: 7 8 9 / 4 5 6 / 1 2 3 / ⌫ 0 ✓ */}
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
