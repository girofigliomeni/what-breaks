"use client";

import { useEffect, useState } from "react";

export function useStaleRun(updatedAt: string, finished: boolean, initiallyStale = false) {
  const [expiredAt, setExpiredAt] = useState<string | null>(initiallyStale ? updatedAt : null);
  useEffect(() => {
    if (finished) return;
    // This timer only changes a label locally; it never queries the database.
    const timer = setTimeout(() => setExpiredAt(updatedAt), Math.max(0, Date.parse(updatedAt) + 5 * 60_000 - Date.now()));
    return () => clearTimeout(timer);
  }, [updatedAt, finished]);
  return !finished && expiredAt === updatedAt;
}
