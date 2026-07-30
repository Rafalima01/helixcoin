"use client";

import { useCallback, useState } from "react";

const DEVICE_ID_KEY = "helijump.push.deviceId";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** PushManager.subscribe() needs the VAPID public key as a raw Uint8Array, not the base64url string the API hands back. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Desconhecido";
}

function detectOs(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Desconhecido";
}

export type PushPermissionState = "unsupported" | "default" | "denied" | "granted" | "subscribing" | "subscribed" | "error";

/** Lazy useState initializer (not an effect) — reads browser capability once, synchronously, on first client render. Returns "default" during SSR (this hook is only ever used from "use client" components, so it's never actually rendered server-side, but the check keeps it safe either way. */
function detectInitialState(): PushPermissionState {
  if (typeof window === "undefined") return "default";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "default";
}

/**
 * Client orchestration for Web Push: registers public/sw.js, requests
 * notification permission, subscribes via PushManager, and posts the
 * subscription to POST /api/push/subscribe. Only ever called from the
 * Admin and Manager UIs this phase (see AGENTS.md's Fase X scope note) —
 * the hook itself has no role awareness, it just does what it's told.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushPermissionState>(detectInitialState);

  const enable = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      setState("unsupported");
      return;
    }

    setState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyJson = await keyRes.json();
      const publicKey: string = keyJson.data.publicKey;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getOrCreateDeviceId(),
          browser: detectBrowser(),
          os: detectOs(),
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      if (!res.ok) throw new Error("Falha ao registrar dispositivo");

      setState("subscribed");
    } catch (err) {
      console.error("push subscribe failed", err);
      setState("error");
    }
  }, []);

  return { state, enable };
}
