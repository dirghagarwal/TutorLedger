"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OfflineQueueItem = {
  id: string;
  kind: "attendance" | "payment";
  payload: unknown;
};

const STORAGE_KEY = "tutorledger:workflow-queue:v1";

function readQueue(): OfflineQueueItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as OfflineQueueItem[] : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useOfflineQueue(processItem: (item: OfflineQueueItem) => Promise<boolean>) {
  const processor = useRef(processItem);
  const [queuedCount, setQueuedCount] = useState(() => typeof window === "undefined" ? 0 : readQueue().length);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = readQueue();
    const remaining: OfflineQueueItem[] = [];
    for (const item of queue) {
      if (!(await processor.current(item))) remaining.push(item);
    }
    writeQueue(remaining);
    setQueuedCount(remaining.length);
  }, []);

  useEffect(() => {
    processor.current = processItem;
  }, [processItem]);

  useEffect(() => {
    const handleOnline = () => void sync();
    window.addEventListener("online", handleOnline);
    const initialSync = window.setTimeout(() => void sync(), 0);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", handleOnline);
    };
  }, [sync]);

  const enqueue = useCallback((item: Omit<OfflineQueueItem, "id">) => {
    const queue = [...readQueue(), { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }];
    writeQueue(queue);
    setQueuedCount(queue.length);
  }, []);

  return { enqueue, queuedCount, sync };
}
