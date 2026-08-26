"use client";

import { useRef } from "react";
import { useNumpad } from "./NumpadContext";

interface Props {
  pct: number; // 0–100
  onChange: (pct: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function PctInput({ pct, onChange, className, style }: Props) {
  const id = useRef(Symbol()).current;
  const numpad = useNumpad();
  const isActive = numpad?.session?.id === id;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        numpad?.open(id, pct, onChange);
      }}
      className={className}
      style={{
        cursor: "pointer",
        background: "transparent",
        border: "none",
        padding: 0,
        outline: isActive ? "1px solid oklch(0.55 0.15 260)" : "none",
        borderRadius: 3,
        ...style,
      }}
    >
      {Math.round(pct)}%
    </button>
  );
}
