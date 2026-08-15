import { useEffect, useState } from "react";

/* Keeps fast typing from thrashing filtering work on every keystroke. */
export const useDebounced = <T,>(value: T, delay = 180): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
