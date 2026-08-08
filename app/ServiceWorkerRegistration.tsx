"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          void registration.update();
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
