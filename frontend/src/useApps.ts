import { useCallback, useEffect, useState } from "react";
import type { AppEntry } from "./types";

let cache: AppEntry[] | null = null;

async function loadApps(): Promise<AppEntry[]> {
  if (cache) return cache;
  const res = await fetch("/data/apps.json");
  const data = await res.json();
  cache = data.apps as AppEntry[];
  return cache;
}

export function useApps() {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => {
    loadApps().then(setApps);
  }, []);

  const search = useCallback(async (query: string): Promise<AppEntry[]> => {
    const all = await loadApps();
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((tag) => tag.includes(q))
    );
  }, []);

  return { apps, search };
}
