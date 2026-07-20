"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    SwaggerUIBundle?: {
      (config: Record<string, unknown>): unknown;
      presets: { apis: unknown };
    };
    SwaggerUIStandalonePreset?: unknown;
  }
}

export function SwaggerUiClient() {
  const [bundleLoaded, setBundleLoaded] = useState(false);
  const [presetLoaded, setPresetLoaded] = useState(false);

  useEffect(() => {
    if (!bundleLoaded || !presetLoaded) return;
    const bundle = window.SwaggerUIBundle;
    if (!bundle) return;

    bundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      presets: [bundle.presets.apis, window.SwaggerUIStandalonePreset].filter(Boolean),
    });
  }, [bundleLoaded, presetLoaded]);

  return (
    <>
      <Script
        src="/swagger-ui/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => setBundleLoaded(true)}
      />
      <Script
        src="/swagger-ui/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
        onLoad={() => setPresetLoaded(true)}
      />
    </>
  );
}
