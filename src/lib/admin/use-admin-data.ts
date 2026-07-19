"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

/**
 * Data hook for backoffice screens. Phase 1 resolves mocks (with a small
 * simulated latency so loading skeletons are real); later phases swap the
 * service internals for HTTP without touching any screen.
 */
export function useAdminData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetcher().then((d) => {
        if (active) setData(d);
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetcher]);

  return { data, loading: data === undefined };
}

/** Placeholder for every mutating action — wired to real services in Phase 2+. */
export function notImplemented() {
  toast("Disponível na próxima fase de implementação.", { icon: "🔒" });
}
