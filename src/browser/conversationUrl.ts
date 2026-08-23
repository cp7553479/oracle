const CONVERSATION_ID_PATH = /\/c\/([a-zA-Z0-9-]+)(?=[/?#]|$)/;

/**
 * Extract a durable ChatGPT conversation id from a URL.
 *
 * ChatGPT can briefly expose client-created routes such as `/c/WEB:<request-id>`
 * before replacing them with the persisted conversation URL. Those transient
 * routes must not be used to scope assistant-response capture or reattachment.
 */
export function extractStableConversationIdFromUrl(url: string): string | undefined {
  if (!url) return undefined;
  return url.match(CONVERSATION_ID_PATH)?.[1];
}

export function isStableConversationUrl(url: string): boolean {
  return extractStableConversationIdFromUrl(url) !== undefined;
}

const CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

/**
 * Returns only stable ChatGPT conversation IDs.
 *
 * The redesigned ChatGPT UI briefly exposes URLs such as `/c/WEB:<id>` while
 * creating a conversation. Those are transition URLs, not IDs that can be used
 * to match the eventual assistant turn.
 */
export function extractCanonicalConversationId(url: string): string | undefined {
  if (!url) return undefined;
  const rawId = url.match(/\/c\/([^/?#]+)/)?.[1];
  return rawId && CONVERSATION_ID_PATTERN.test(rawId) ? rawId : undefined;
}

export function isCanonicalConversationUrl(url: string): boolean {
  return extractCanonicalConversationId(url) !== undefined;
}
