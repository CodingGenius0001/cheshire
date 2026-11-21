// Entry point App.tsx imports. Same hook as hooks/useListener, but it starts
// listening on mount because the main screen has no mic button.
import { useEffect } from "react";
import { useListener as useBaseListener, type Listener } from "../hooks/useListener";

export type { Listener };

export function useListener(lang?: string): Listener {
  const listener = useBaseListener(lang);
  const { start, stop } = listener;
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);
  return listener;
}
