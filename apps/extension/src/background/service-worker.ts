import { getSupabase } from "../lib/supabase";
import { saveJob } from "../lib/api";
import { RAW_TEXT_CAP } from "@job-analyzer/shared";

const MENU_ID = "save-selection-to-job-tracker";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save selection to Job Tracker",
    contexts: ["selection"],
  });
});

async function flashBadge(text: string, color: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  // Cosmetic auto-clear; if the SW is torn down first, the badge simply lingers.
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 4000);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const text = (info.selectionText ?? "").trim();
  const url = tab?.url ?? info.pageUrl;
  if (!text || !url) {
    await flashBadge("✕", "#dc2626");
    return;
  }

  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      // Not signed in — nudge the user to open the popup and sign in.
      await flashBadge("!", "#f59e0b");
      return;
    }
    const res = await saveJob(token, { rawText: text.slice(0, RAW_TEXT_CAP), sourceUrl: url });
    await flashBadge("✓", res.parseStatus === "ok" ? "#16a34a" : "#f59e0b");
  } catch {
    await flashBadge("✕", "#dc2626");
  }
});
