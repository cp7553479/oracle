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
