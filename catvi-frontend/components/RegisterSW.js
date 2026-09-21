"use client";
import { useEffect } from "react";
export default function RegisterSW() {
  useEffect(() => {
    // Replace the old cache-first worker, which could intercept measurements.
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            if (
              registration.active?.scriptURL ===
              new URL("/sw.js", location.origin).href
            )
              registration.update().catch(() => {});
          }
        })
        .catch(() => {});
  }, []);
  return null;
}
