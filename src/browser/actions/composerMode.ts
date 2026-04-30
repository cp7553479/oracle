import type { BrowserLogger, ChromeClient } from "../types.js";
import { logDomFailure } from "../domDebug.js";
import { buildClickDispatcher } from "./domEvents.js";

export async function ensureCreateImageMode(
  Runtime: ChromeClient["Runtime"],
  logger: BrowserLogger,
): Promise<void> {
  const outcome = await Runtime.evaluate({
    expression: buildCreateImageModeExpression(),
    awaitPromise: true,
    returnByValue: true,
  });

  const result = outcome.result?.value as
    | { status: "selected"; label?: string | null }
    | { status: "already-selected"; label?: string | null }
    | { status: "option-not-found"; availableOptions?: string[] }
    | { status: "button-missing" }
    | undefined;

  switch (result?.status) {
    case "selected":
    case "already-selected": {
      logger(`Composer mode: ${result.label ?? "Create image"}`);
      return;
    }
    case "option-not-found": {
      await logDomFailure(Runtime, logger, "create-image-mode-option");
      const available = (result.availableOptions ?? []).filter(Boolean);
      const suffix = available.length > 0 ? ` Available: ${available.join(", ")}.` : "";
      logger(`Composer mode: unable to find Create image option; continuing.${suffix}`);
      return;
    }
    default:
      await logDomFailure(Runtime, logger, "create-image-mode-button");
      logger("Composer mode: unable to locate add menu; continuing.");
  }
}

function buildCreateImageModeExpression(): string {
  return `(() => {
    ${buildClickDispatcher()}
    const BUTTON_SELECTORS = [
      '#composer-plus-btn',
      'button[data-testid="composer-plus-btn"]',
      'button[aria-label="Add files and more"]',
      'button[aria-label="添加文件等"]',
      'button[aria-haspopup="menu"][data-testid*="composer"]',
    ];
    const OPTION_LABELS = ['create image', '创建图片'];
    const INITIAL_WAIT_MS = 150;
    const REOPEN_INTERVAL_MS = 400;
    const MAX_WAIT_MS = 15000;
    const normalize = (value) => String(value || '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const labelMatches = (value) => {
      const normalized = normalize(value);
      return OPTION_LABELS.some((label) => normalized.includes(label));
    };
    const findAddButton = () => {
      for (const selector of BUTTON_SELECTORS) {
        const nodes = Array.from(document.querySelectorAll(selector));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return node;
        }
      }
      return null;
    };
    let button = findAddButton();
    const getButton = () => {
      if (!button || !document.contains(button)) {
        button = findAddButton();
      }
      return button;
    };
    const collectAvailableOptions = () => {
      const menuRoots = Array.from(document.querySelectorAll('[role="menu"], [data-radix-collection-root]'));
      const nodes = menuRoots.length > 0
        ? menuRoots.flatMap((root) => Array.from(root.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button')))
        : Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'));
      return nodes
        .map((node) => (node?.textContent ?? '').trim())
        .filter(Boolean)
        .filter((label, index, arr) => arr.indexOf(label) === index)
        .slice(0, 12);
    };
    const findCreateImageOption = () => {
      const menus = Array.from(document.querySelectorAll('[role="menu"], [data-radix-collection-root]'));
      for (const menu of menus) {
        const options = Array.from(menu.querySelectorAll('[role="menuitemradio"], [role="menuitem"], button'));
        for (const option of options) {
          const label = (option.textContent ?? '').trim();
          const aria = option.getAttribute?.('aria-label') ?? '';
          if (labelMatches(label) || labelMatches(aria)) {
            return { node: option, label: label || aria || 'Create image' };
          }
        }
      }
      return null;
    };
    const isSelected = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.getAttribute('aria-checked') === 'true' || node.getAttribute('aria-selected') === 'true') {
        return true;
      }
      const dataState = (node.getAttribute('data-state') ?? '').toLowerCase();
      return dataState === 'checked' || dataState === 'selected';
    };
    let lastPointerClick = 0;
    const pointerClick = () => {
      const currentButton = getButton();
      if (currentButton && dispatchClickSequence(currentButton)) {
        lastPointerClick = performance.now();
      }
    };
    return new Promise((resolve) => {
      const start = performance.now();
      let initialized = false;
      const attempt = async () => {
        if (!getButton()) {
          if (performance.now() - start > MAX_WAIT_MS) {
            resolve({ status: 'button-missing' });
            return;
          }
          setTimeout(attempt, REOPEN_INTERVAL_MS / 2);
          return;
        }
        if (!initialized) {
          initialized = true;
          pointerClick();
          await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS));
        }
        const menuOpen = document.querySelector('[role="menu"], [data-radix-collection-root]');
        if (!menuOpen && performance.now() - lastPointerClick > REOPEN_INTERVAL_MS) {
          pointerClick();
        }
        const option = findCreateImageOption();
        if (option) {
          if (isSelected(option.node)) {
            dispatchClickSequence(getButton());
            resolve({ status: 'already-selected', label: option.label });
            return;
          }
          dispatchClickSequence(option.node);
          resolve({ status: 'selected', label: option.label });
          return;
        }
        if (performance.now() - start > MAX_WAIT_MS) {
          resolve({ status: 'option-not-found', availableOptions: collectAvailableOptions() });
          return;
        }
        setTimeout(attempt, REOPEN_INTERVAL_MS / 2);
      };
      attempt();
    });
  })()`;
}

export function buildCreateImageModeExpressionForTest(): string {
  return buildCreateImageModeExpression();
}
