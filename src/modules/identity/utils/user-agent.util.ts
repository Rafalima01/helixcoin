import { UAParser } from "ua-parser-js";

export interface ParsedUserAgent {
  os: string | null;
  browser: string | null;
  device: string | null;
}

/** "Controle de dispositivos" — turns a raw User-Agent header into the OS/browser/device shown on a session card. */
export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) return { os: null, browser: null, device: null };

  const result = new UAParser(userAgent).getResult();
  const os = result.os.name ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ""}` : null;
  const browser = result.browser.name
    ? `${result.browser.name}${result.browser.major ? ` ${result.browser.major}` : ""}`
    : null;
  const device = result.device.model
    ? `${result.device.vendor ?? ""} ${result.device.model}`.trim()
    : (result.device.type ?? "Desktop");

  return { os, browser, device };
}
