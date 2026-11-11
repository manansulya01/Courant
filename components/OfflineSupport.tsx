"use client";

import { useEffect } from "react";

export default function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline practice remains usable online if service workers are unavailable.
    });
  }, []);

  return null;
}
