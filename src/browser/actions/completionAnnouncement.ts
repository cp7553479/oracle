import { buildConversationTurnListExpression } from "../conversationTurns.js";

const TRACKER_KEY = "__oracleCurrentTurnCompletionV1";

/**
 * ChatGPT alternates between the English status and localized wordings
 * ("回复已完成" / "回答已完成" / "响应已完成"); accept the completed-status
 * text with any of the known prefixes so a finished answer is not missed.
 * Interpolated into browser-context expressions — use the source string.
 */
export const COMPLETE_STATUS_PATTERN = "(?:response complete|(?:回复|回答|响应)?已完成)";

/** Start before prompt dispatch so even a fast answer has a turn-scoped completion signal. */
export function buildInstallCompletionAnnouncementExpression(
  baselineTurns?: number | null,
): string {
  const baselineLiteral =
    typeof baselineTurns === "number" && Number.isFinite(baselineTurns) && baselineTurns >= 0
      ? Math.floor(baselineTurns)
      : "null";
  return `(() => {
    const key = ${JSON.stringify(TRACKER_KEY)};
    window[key]?.observer?.disconnect?.();
    const turns = () => ${buildConversationTurnListExpression()};
    const baseline = ${baselineLiteral} ?? turns().length;
    const COMPLETE_STATUS_RE = /${COMPLETE_STATUS_PATTERN}/i;
    const completeNode = () => Array.from(
      document.querySelectorAll('[role="status"][aria-live="polite"]'),
    ).find((node) => COMPLETE_STATUS_RE.test((node.textContent || '').trim())) ?? null;
    const isAssistant = (node) => {
      const key = (node.getAttribute?.('data-content-search-unit-key') || node.getAttribute?.('data-chatgpt-search-unit-key') || '').toLowerCase();
      if (key.endsWith(':user')) return false;
      if (key.endsWith(':assistant')) return true;
      const role = (node.getAttribute?.('data-message-author-role') || node.getAttribute?.('data-turn') || '').toLowerCase();
      if (role === 'user') return false;
      if (role === 'assistant') return true;
      return Boolean(node.querySelector?.('[data-content-search-unit-key$=":assistant"], [data-chatgpt-search-unit-key$=":assistant"], [data-message-author-role="assistant"], [data-turn="assistant"]'));
    };
    const tracker = {
      baseline,
      priorCompleteNode: completeNode(),
      sawIncomplete: false,
      completedTurnIndex: null,
      observer: null,
    };
    tracker.sawIncomplete = !tracker.priorCompleteNode;
    const observe = () => {
      const currentCompleteNode = completeNode();
      if (!currentCompleteNode) {
        tracker.sawIncomplete = true;
        tracker.priorCompleteNode = null;
        return;
      }
      if (!tracker.sawIncomplete && currentCompleteNode === tracker.priorCompleteNode) return;
      const currentTurns = turns();
      for (let index = currentTurns.length - 1; index >= baseline; index -= 1) {
        if (!isAssistant(currentTurns[index])) continue;
        tracker.completedTurnIndex = index;
        tracker.sawIncomplete = false;
        tracker.priorCompleteNode = currentCompleteNode;
        tracker.observer?.disconnect();
        return;
      }
    };
    tracker.observer = new MutationObserver(observe);
    tracker.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window[key] = tracker;
    return { baseline };
  })()`;
}

export function buildReadCompletionAnnouncementExpression(turnIndex: number): string {
  return `(() => {
    const tracker = window[${JSON.stringify(TRACKER_KEY)}];
    return tracker?.completedTurnIndex === ${Math.floor(turnIndex)} &&
      tracker.completedTurnIndex >= tracker.baseline;
  })()`;
}
