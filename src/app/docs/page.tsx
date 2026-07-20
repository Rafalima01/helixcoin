import type { Metadata } from "next";
import { SwaggerUiClient } from "@/app/docs/swagger-ui-client";

export const metadata: Metadata = {
  title: "API Docs — HeliJump",
  robots: { index: false, follow: false },
};

/**
 * Self-hosted Swagger UI (assets vendored under public/swagger-ui — no CDN
 * dependency) rendering /api/openapi.json. See src/server/docs/openapi.ts
 * for the spec source.
 */
export default function ApiDocsPage() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- vendored Swagger UI
          CSS served as-is from public/; Next's CSS pipeline is for app
          stylesheets, not a 178KB third-party bundle we don't want processed. */}
      <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
      <div id="swagger-ui" />
      <SwaggerUiClient />
    </>
  );
}
