"use client";

// TEMPORARY debug 404 — investigating an iOS "Add to Home Screen" issue where
// the PWA hits a 404 that doesn't reproduce in regular Safari. No cookie
// values, tokens, or secrets are read/shown — only URL/display-mode info,
// which is what's needed to see the exact request the standalone container
// actually made (iOS hides the address bar in standalone mode). Remove once
// the real 404 is captured and the root cause is fixed.
import { useEffect, useState } from "react";

export default function NotFound() {
  const [info, setInfo] = useState("coletando...");

  useEffect(() => {
    const standaloneMedia =
      typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone =
      typeof window !== "undefined" && (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setInfo(
      JSON.stringify(
        {
          href: window.location.href,
          host: window.location.host,
          pathname: window.location.pathname,
          search: window.location.search,
          standaloneMedia,
          iosStandalone,
          referrer: document.referrer || "(vazio)",
          userAgent: navigator.userAgent,
        },
        null,
        2
      )
    );
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        fontFamily: "monospace",
        background: "#0B0815",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>404</div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>DEBUG temporário — tire print desta tela</div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontSize: 12,
          maxWidth: 480,
          textAlign: "left",
          background: "rgba(255,255,255,0.05)",
          padding: 16,
          borderRadius: 8,
        }}
      >
        {info}
      </pre>
    </div>
  );
}
