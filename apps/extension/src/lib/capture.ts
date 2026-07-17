export interface Capture {
  text: string;
  title: string;
}

/**
 * Runs in the PAGE context via chrome.scripting.executeScript, so it must be
 * fully self-contained — no imports, no closure references. `cap` is passed as
 * an argument. Ordered fallback per the PRD: (1) the user's selection, (2) the
 * largest main/article block, (3) full body innerText.
 */
export function capturePageText(cap: number): Capture {
  const clean = (s: string) =>
    s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const selection = (window.getSelection?.()?.toString() ?? "").trim();
  if (selection.length > 40) {
    return { text: clean(selection).slice(0, cap), title: document.title };
  }

  const blocks = Array.from(
    document.querySelectorAll("main, article, [role='main']"),
  ) as HTMLElement[];
  let best: HTMLElement | null = null;
  let bestLen = 0;
  for (const el of blocks) {
    const len = el.innerText?.length ?? 0;
    if (len > bestLen) {
      best = el;
      bestLen = len;
    }
  }

  const raw = best?.innerText || document.body?.innerText || "";
  return { text: clean(raw).slice(0, cap), title: document.title };
}

/** Inject the capture into the active tab and return its text + URL. */
export async function captureActiveTab(cap: number): Promise<{ capture: Capture; url: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab to capture.");
  if (!/^https?:/.test(tab.url)) {
    throw new Error("This page can't be captured — open a job posting first.");
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: capturePageText,
    args: [cap],
  });

  const capture = injection?.result as Capture | undefined;
  if (!capture?.text) throw new Error("Couldn't find any text to capture on this page.");
  return { capture, url: tab.url };
}
