import type { ChromeClient, BrowserAttachment, BrowserLogger } from "../types.js";
import { delay } from "../utils.js";

// 2026-09 ChatGPT composer: #composer-plus-btn is gone. The plus control is a
// pill button annotated data-composer-navigation-target="add-context" whose
// accessible label is localized ("添加文件等内容" / "Add files and more").
const PLUS_BUTTON_SELECTORS = [
  '[data-composer-navigation-target="add-context"]',
  '#composer-plus-btn',
  'button[data-testid="composer-plus-btn"]',
];

const PLUS_BUTTON_LABEL_PATTERN = /添加文件|附加|上传|add files?|attach(ment)? files?|plus/i;

// Menu entry that opens the OS file chooser. The menu itself renders as a
// portal without role=menu, so items are located by their exact short text.
const UPLOAD_ITEM_PATTERN = /从电脑上传|上传文件|上传照片|upload from computer|upload files?/i;

interface FileChooserUploadDeps {
  runtime: ChromeClient["Runtime"];
  dom?: ChromeClient["DOM"];
  input?: ChromeClient["Input"];
  page?: ChromeClient["Page"];
  client?: FileChooserEventClient;
}

interface FileChooserEventClient {
  on(event: "Page.fileChooserOpened", callback: (params: unknown) => void): void;
  off?(event: string, callback: unknown): void;
}

interface Point {
  x: number;
  y: number;
}

async function evaluate<T>(
  runtime: ChromeClient["Runtime"],
  expression: string,
): Promise<T | undefined> {
  const response = await runtime.evaluate({ expression, returnByValue: true });
  const value = response?.result?.value;
  return typeof value === "undefined" ? undefined : (value as T);
}

async function trustedClick(
  input: ChromeClient["Input"] | undefined,
  runtime: ChromeClient["Runtime"],
  point: Point,
): Promise<void> {
  if (input && typeof input.dispatchMouseEvent === "function") {
    await input.dispatchMouseEvent({
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    await input.dispatchMouseEvent({
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    return;
  }
  await runtime.evaluate({
    expression: `(() => { const target = document.elementFromPoint(${point.x}, ${point.y}); target?.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true})); return true; })()`,
    returnByValue: true,
  });
}

const FIND_PLUS_BUTTON_EXPRESSION = `(() => {
  const selectors = ${JSON.stringify(PLUS_BUTTON_SELECTORS)};
  const labelPattern = /${PLUS_BUTTON_LABEL_PATTERN.source}/i;
  let button = null;
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement && node.getBoundingClientRect().width > 0) { button = node; break; }
  }
  if (!button) {
    button = [...document.querySelectorAll('button, [role="button"]')].find((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const label = node.getAttribute('aria-label') || '';
      return labelPattern.test(label) && node.getBoundingClientRect().width > 0;
    }) || null;
  }
  if (!(button instanceof HTMLElement)) return null;
  const rect = button.getBoundingClientRect();
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    expanded: button.getAttribute('aria-expanded'),
  };
})()`;

const FIND_UPLOAD_ITEM_EXPRESSION = `(() => {
  const pattern = /${UPLOAD_ITEM_PATTERN.source}/i;
  const direct = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="button"]')]
    .find((node) => pattern.test((node.textContent || '').trim()) && (node.textContent || '').trim().length < 40);
  const target = direct || [...document.querySelectorAll('body *')].find((node) => {
    const ownText = [...node.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    return ownText && pattern.test(ownText) && ownText.length < 40;
  }) || null;
  if (!target) return null;
  const clickable = target.closest('button, [role="menuitem"], [role="menuitemradio"], li') || target;
  const rect = clickable.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
})()`;

const DIAG_PLUS_BUTTON_EXPRESSION = `(() => {
  const nodes = [...document.querySelectorAll('[data-composer-navigation-target]')];
  const one = document.querySelector('#composer-plus-btn, [data-composer-navigation-target="add-context"]');
  return {
    url: location.href,
    navCount: nodes.length,
    nav: nodes.map((n) => n.tagName + ':' + n.getAttribute('data-composer-navigation-target') + ':w' + Math.round(n.getBoundingClientRect().width)),
    matched: one ? one.tagName : null,
    buttons: document.querySelectorAll('button').length,
  };
})()`;

const DIAG_MENU_EXPRESSION = `(() => {
  const plus = document.querySelector('[data-composer-navigation-target="add-context"]');
  const texts = [...document.querySelectorAll('body *')]
    .map((n) => [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim())
    .filter((t) => t && t.length < 40 && /上传|添加|文件|upload|add|file/i.test(t))
    .slice(0, 20);
  return {
    expanded: plus ? plus.getAttribute('aria-expanded') : null,
    popper: !!document.querySelector('[data-radix-popper-content-wrapper]'),
    openState: [...document.querySelectorAll('[data-state="open"]')].length,
    texts,
  };
})()`;

const ATTACHMENT_SIGNAL_EXPRESSION = `(() => {
  const form = document.querySelector('form');
  const previews = form
    ? [...form.querySelectorAll('img')].filter((img) => {
        const src = img.getAttribute('src') || '';
        return src.startsWith('data:') || src.startsWith('blob:');
      }).length
    : 0;
  const chips = document.querySelectorAll(
    '[data-testid*="attachment"], [aria-label*="Remove" i], [aria-label*="remove" i]',
  ).length;
  let queuedFiles = 0;
  for (const input of document.querySelectorAll('input[type="file"]')) {
    if (input instanceof HTMLInputElement) queuedFiles += Array.from(input.files || []).length;
  }
  return { previews, chips, queuedFiles };
})()`;

async function readAttachmentSignal(
  runtime: ChromeClient["Runtime"],
): Promise<{ previews: number; chips: number; queuedFiles: number }> {
  const value = await evaluate<{ previews?: number; chips?: number; queuedFiles?: number }>(
    runtime,
    ATTACHMENT_SIGNAL_EXPRESSION,
  );
  return {
    previews: typeof value?.previews === "number" ? value.previews : 0,
    chips: typeof value?.chips === "number" ? value.chips : 0,
    queuedFiles: typeof value?.queuedFiles === "number" ? value.queuedFiles : 0,
  };
}

async function pressEscape(input: ChromeClient["Input"] | undefined): Promise<void> {
  if (!input || typeof input.dispatchKeyEvent !== "function") return;
  const key = { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await input.dispatchKeyEvent({ type: "keyDown", ...key }).catch(() => undefined);
  await input.dispatchKeyEvent({ type: "keyUp", ...key }).catch(() => undefined);
}

/**
 * Upload one attachment through the real user path: open the composer plus
 * menu, click the "upload from computer" entry, and satisfy the intercepted
 * file chooser with DOM.setFileInputFiles on the chooser's backendNodeId.
 *
 * 2026-09 note: setting files directly on the persistent hidden inputs no
 * longer registers with the ChatGPT composer; only the intercepted chooser
 * path commits the file. Returns true when a composer attachment signal is
 * observed; returns false on any failure so callers can fall back.
 */
export async function uploadAttachmentViaFileChooser(
  deps: FileChooserUploadDeps,
  attachment: BrowserAttachment,
  logger: BrowserLogger,
  options?: { menuTimeoutMs?: number; chooserTimeoutMs?: number; signalTimeoutMs?: number },
): Promise<boolean> {
  const { runtime, dom, input, page, client } = deps;
  if (!page || !client || !dom) return false;
  if (typeof page.setInterceptFileChooserDialog !== "function") return false;

  const menuTimeoutMs = options?.menuTimeoutMs ?? 10_000;
  const chooserTimeoutMs = options?.chooserTimeoutMs ?? 15_000;
  const signalTimeoutMs = options?.signalTimeoutMs ?? 20_000;

  let chooserOpened: Promise<{ backendNodeId?: number; nodeId?: number } | null> | null = null;
  let interceptionEnabled = false;

  const disableInterception = async () => {
    if (!interceptionEnabled) return;
    interceptionEnabled = false;
    await page.setInterceptFileChooserDialog({ enabled: false }).catch(() => undefined);
  };

  try {
    const initial = await readAttachmentSignal(runtime);
    await page.setInterceptFileChooserDialog({ enabled: true });
    interceptionEnabled = true;

    chooserOpened = new Promise((resolve) => {
      const cleanup = { detach: undefined as undefined | (() => void) };
      let settled = false;
      const settle = (value: { backendNodeId?: number; nodeId?: number } | null) => {
        if (settled) return;
        settled = true;
        cleanup.detach?.();
        resolve(value);
      };
      const timer = setTimeout(() => settle(null), chooserTimeoutMs);
      const onFileChooserOpened = (params: unknown) => {
        const { backendNodeId, nodeId } = (params ?? {}) as { backendNodeId?: number; nodeId?: number };
        settle({ backendNodeId, nodeId });
      };
      cleanup.detach = () => {
        clearTimeout(timer);
        client.off?.("Page.fileChooserOpened", onFileChooserOpened);
      };
      client.on("Page.fileChooserOpened", onFileChooserOpened);
    });

    // Open the plus menu when it is not already expanded.
    let button = await evaluate<{ x: number; y: number; expanded: string | null } | null>(
      runtime,
      FIND_PLUS_BUTTON_EXPRESSION,
    );
    if (!button) {
      const diag = await evaluate<unknown>(runtime, DIAG_PLUS_BUTTON_EXPRESSION);
      logger(`[browser] fallback File-chooser upload: plus button missing. ${JSON.stringify(diag)}`);
      return false;
    }
    if (button.expanded !== "true") {
      await trustedClick(input, runtime, { x: button.x, y: button.y });
      await delay(600);
    }

    // Wait for the "upload from computer" entry, then click it.
    const menuDeadline = Date.now() + menuTimeoutMs;
    let item: Point | null | undefined;
    while (Date.now() < menuDeadline && !item) {
      item = (await evaluate<Point | null>(runtime, FIND_UPLOAD_ITEM_EXPRESSION)) ?? null;
      if (!item) await delay(300);
    }
    if (!item) {
      const diag = await evaluate<unknown>(runtime, DIAG_MENU_EXPRESSION);
      logger(`[browser] fallback File-chooser upload: menu entry not found. ${JSON.stringify(diag)}`);
      await pressEscape(input);
      return false;
    }
    await trustedClick(input, runtime, item);

    const chooser = await chooserOpened;
    if (!chooser || (chooser.backendNodeId === undefined && chooser.nodeId === undefined)) {
      logger("[browser] fallback File-chooser upload: ChatGPT never opened the file chooser.");
      await pressEscape(input);
      return false;
    }

    const setParams: { files: string[]; backendNodeId?: number; nodeId?: number } = {
      files: [attachment.path],
    };
    if (chooser.backendNodeId !== undefined) setParams.backendNodeId = chooser.backendNodeId;
    else if (chooser.nodeId !== undefined) setParams.nodeId = chooser.nodeId;
    await dom.setFileInputFiles(setParams as Parameters<typeof dom.setFileInputFiles>[0]);
    await disableInterception();

    // Wait until the composer acknowledges the file (preview/chip/queued input).
    const signalDeadline = Date.now() + signalTimeoutMs;
    for (;;) {
      const signal = await readAttachmentSignal(runtime);
      const grew =
        signal.previews > initial.previews ||
        signal.chips > initial.chips ||
        signal.queuedFiles > initial.queuedFiles;
      if (grew) {
        logger(
          `Attachment queued via file chooser (previews=${signal.previews}, chips=${signal.chips}, queued=${signal.queuedFiles})`,
        );
        return true;
      }
      if (Date.now() >= signalDeadline) break;
      await delay(400);
    }
    logger("[browser] fallback File-chooser upload: composer did not acknowledge the file in time.");
    return false;
  } catch (error) {
    logger(
      `[browser] fallback File-chooser upload failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  } finally {
    await disableInterception();
    chooserOpened?.catch(() => undefined);
  }
}
