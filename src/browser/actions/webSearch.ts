import type { ChromeClient, BrowserLogger } from "../types.js";
import { BrowserAutomationError } from "../../oracle/errors.js";
import { INPUT_SELECTORS } from "../constants.js";
import { delay } from "../utils.js";
import {
  activateComposerPlus,
  captureComposerNavigationUrl,
  assertComposerPlusStayedInPlace,
} from "./attachments.js";
import { buildComposerNavigationValidationExpression } from "./attachmentContext.js";
import { buildClickDispatcher } from "./domEvents.js";

export function matchesWebSearchMenuLabel(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  // 精确匹配(英文已知 label, 含"标题+描述"拼接形式)
  if (
    ["search", "searchfindontheweb", "websearch", "websearchfindreal-timenewsandinfo"].includes(
      normalized,
    )
  ) {
    return true;
  }
  // 本地化界面会把"标题+描述"无缝拼接(如 网页搜索查找实时新闻和信息)。
  // 仅对中文标签做前缀匹配, 且要求剩余部分仍以中文开头, 避免误匹配英文近义词。
  return ["搜索网页", "网页搜索", "联网搜索", "网络搜索", "搜索网络", "搜索互联网"].some(
    (label) => {
      if (!normalized.startsWith(label)) return false;
      const rest = normalized.slice(label.length);
      return rest === "" || /[\u4e00-\u9fff]/.test(rest[0]);
    },
  );
}

export function buildWebSearchVerificationExpression(prompt: string): string {
  return `(() => {
    const visible = node => node instanceof HTMLElement && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    const editor = ${JSON.stringify(INPUT_SELECTORS)}.flatMap(selector => Array.from(document.querySelectorAll(selector))).find(visible);
    if (!editor) return { selected: false, promptMatches: false };
    const chip = editor.querySelector('[data-inline-selection-pill][data-id="search"][data-system-hint-type="search"]');
    const copy = editor.cloneNode(true);
    copy.querySelectorAll('[data-inline-selection-pill], [data-inline-selection-pill-cursor-target]').forEach(node => node.remove());
    const readText = node => {
      if (node.nodeType === 3) return node.textContent ?? '';
      const text = Array.from(node.childNodes).map(readText).join('');
      return text + (['P', 'DIV', 'BR', 'LI', 'PRE'].includes(node.nodeName) ? '\\n' : '');
    };
    const normalize = text => String(text ?? '').replace(/[\\u200b\\ufeff]/g, '').replace(/\\s+/g, ' ').trim();
    const a = normalize(readText(copy));
    const b = normalize(${JSON.stringify(prompt)});
    // 宽松比对: 编辑器对长多行文本会做段落重排, 逐字比对误报。前缀一致且长度差 <8% 即视为同一 prompt。
    const lenOk = Math.abs(a.length - b.length) <= Math.max(40, b.length * 0.08);
    const headOk = a.slice(0, 200) === b.slice(0, 200) || b.startsWith(a.slice(0, 80));
    return { selected: Boolean(chip && visible(chip)), promptMatches: lenOk && headOk };
  })()`;
}

export function buildWebSearchSelectionExpression(navigationUrl: string): string {
  return `(() => {
    ${buildClickDispatcher()}
    const matchesLabel = ${matchesWebSearchMenuLabel.toString()};
    const navigation = ${buildComposerNavigationValidationExpression(navigationUrl)};
    if (!navigation.contextMatches || navigation.workSelected || navigation.modeUnverified) return 'context-changed';
    const visible = node => node instanceof HTMLElement && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    const roots = Array.from(document.querySelectorAll('main .popover, [data-radix-popper-content-wrapper], [data-floating-ui-portal], [role="menu"], [role="listbox"]')).filter(visible);
    const candidates = roots.flatMap(root => Array.from(root.querySelectorAll('[data-radix-collection-item], [role="menuitem"], [role="option"], .__menu-item, [class*="menu-item"]')));
    const match = candidates.find(node => {
      if (!visible(node) || node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return false;
      return matchesLabel(node.textContent ?? '');
    });
    if (!match) return 'missing:' + candidates.map(n => (n.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 60)).join('|');
    dispatchClickSequence(match);
    return 'clicked';
  })()`;
}

/** Web Search is an inline editor hint, so activate it after staging text/attachments. */
export async function activateWebSearch(
  runtime: ChromeClient["Runtime"],
  input: ChromeClient["Input"],
  prompt: string,
  logger: BrowserLogger,
): Promise<void> {
  const navigationUrl = await captureComposerNavigationUrl(runtime);
  const verify = async () => {
    const { result, exceptionDetails } = await runtime.evaluate({
      expression: buildWebSearchVerificationExpression(prompt),
      returnByValue: true,
    });
    if (exceptionDetails) return false;
    return result?.value?.selected === true && result?.value?.promptMatches === true;
  };
  if (await verify()) return;
  const activated = await activateComposerPlus(runtime, input, navigationUrl);
  if (activated.method === "unavailable")
    throw new BrowserAutomationError("Web Search requires the ChatGPT composer tools menu.", {
      stage: "web-search-activate",
    });
  const deadline = Date.now() + 5_000;
  let clicked = false;
  while (Date.now() < deadline) {
    const outcome = await runtime.evaluate({
      expression: buildWebSearchSelectionExpression(navigationUrl),
      returnByValue: true,
    });
    if (outcome.result?.value === "clicked") {
      clicked = true;
      break;
    }
    if (outcome.exceptionDetails || !String(outcome.result?.value ?? "").startsWith("missing"))
      break;
    if (typeof outcome.result?.value === "string" && outcome.result.value.length > 8) {
      logger(`[web-search-debug] menu candidates: ${outcome.result.value.slice(8)}`);
    }
    await delay(100);
  }
  if (clicked) {
    const confirmationDeadline = Date.now() + 3_000;
    do {
      await assertComposerPlusStayedInPlace(runtime, navigationUrl);
      if (await verify()) {
        logger("Web Search selected; inline search hint and staged prompt verified.");
        return;
      }
      await delay(100);
    } while (Date.now() < confirmationDeadline);
  }
  throw new BrowserAutomationError(
    "Web Search selection could not be verified; the prompt was not submitted. This pilot supports the English ChatGPT Web search control.",
    { stage: "web-search-activate" },
  );
}
