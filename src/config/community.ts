/**
 * Official HelixCoin community link (WhatsApp group/channel). `null` until
 * explicitly configured — components that render a link to it must check
 * for `null` and render nothing rather than fall back to a guessed URL.
 */
export const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL || null;
