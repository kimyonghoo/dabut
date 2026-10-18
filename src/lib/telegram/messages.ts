import { zonedDateParts, DEFAULT_TIMEZONE } from "@/lib/dates/timezone";

export type NotificationAction = "created" | "updated" | "deleted";

const EVENT_VERB: Record<NotificationAction, string> = {
  created: "등록했어요",
  updated: "수정했어요",
  deleted: "삭제했어요",
};

const ACTION_EMOJI: Record<NotificationAction, string> = {
  created: "✅",
  updated: "✏️",
  deleted: "🗑️",
};

const TYPE_LABEL: Record<"expense" | "income", string> = {
  expense: "지출",
  income: "수입",
};

// index 0 (Sun) - 6 (Sat); this bot's messages are Korean-only today (see
// escapeHtml above), so the day-of-week abbreviation is too.
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// Telegram's "HTML" parse_mode only reserves &, <, > (plus " and ' inside
// attributes, which we don't use but escape anyway for safety). Every piece
// of user-controlled text (nicknames, titles, category names, memos) MUST be
// passed through this before being interpolated into a message, since those
// messages are sent, unreviewed, into someone else's chat.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function eventNotificationMessage(input: {
  action: NotificationAction;
  actorName: string;
  title: string;
  startAt: string;
  allDay: boolean;
  // The event owner/actor's configured timezone (this app's recipient is
  // typically a partner in the same timezone, so we don't customize per
  // recipient) — defaults to Asia/Seoul for callers that don't have one.
  timeZone?: string;
}): string {
  const { action, actorName, title, startAt, allDay, timeZone = DEFAULT_TIMEZONE } = input;
  const emoji = ACTION_EMOJI[action];
  const name = escapeHtml(actorName);
  const safeTitle = escapeHtml(title);
  const head = `${emoji} <b>${name}</b>님이 일정을 ${EVENT_VERB[action]}: <b>${safeTitle}</b>`;
  if (action === "deleted") return head;
  const { month, day, hour, minute, weekday } = zonedDateParts(startAt, timeZone);
  const weekdayLabel = `(${KOREAN_WEEKDAYS[weekday]})`;
  const date = allDay
    ? `${month}월 ${day}일 ${weekdayLabel}`
    : `${month}월 ${day}일 ${weekdayLabel} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${head} (${date})`;
}

export function transactionNotificationMessage(input: {
  action: NotificationAction;
  actorName: string;
  type: "expense" | "income";
  amount: number;
  categoryName: string;
  categoryIcon?: string | null;
  memo?: string | null;
}): string {
  const { action, actorName, type, amount, categoryName, categoryIcon, memo } = input;
  const emoji = ACTION_EMOJI[action];
  const name = escapeHtml(actorName);
  const amountText = `${amount.toLocaleString("ko-KR")}원`;
  const categoryLabel = categoryIcon
    ? `${escapeHtml(categoryIcon)} ${escapeHtml(categoryName)}`
    : escapeHtml(categoryName);
  const label = `${categoryLabel} ${TYPE_LABEL[type]}`;
  const trimmedMemo = memo?.trim();
  const memoSuffix = trimmedMemo ? ` — ${escapeHtml(trimmedMemo)}` : "";
  if (action === "created") {
    return `${emoji} <b>${name}</b>님이 ${label} <b>${amountText}</b>을 등록했어요${memoSuffix}`;
  }
  return `${emoji} <b>${name}</b>님이 ${label} 내역을 ${EVENT_VERB[action]}: <b>${amountText}</b>${memoSuffix}`;
}

const MILESTONE_EMOJI: Record<50 | 80 | 100, string> = {
  50: "🔸",
  80: "🔶",
  100: "🎉",
};

/**
 * Achievement-framed message for a payment method ("카드실적") crossing one of
 * the 50/80/100% monthly-goal thresholds. This is sent only to the payment
 * method's own owner (never a connected partner — the goal is private), so
 * unlike the other builders here there's no `actorName`: the recipient is
 * always the one who just made progress toward their own goal.
 *
 * 50%/80% use a plain progress tone; 100%+ is deliberately a distinct,
 * celebratory tone rather than a "you went over" warning — this is an
 * achievement tracker, not a budget cap.
 */
export function paymentMethodMilestoneMessage(input: {
  threshold: 50 | 80 | 100;
  cardName: string;
  spent: number;
  goal: number;
}): string {
  const { threshold, cardName, spent, goal } = input;
  const emoji = MILESTONE_EMOJI[threshold];
  const name = escapeHtml(cardName);
  const spentText = `${spent.toLocaleString("ko-KR")}원`;
  const goalText = `${goal.toLocaleString("ko-KR")}원`;
  const progress = `${spentText} / ${goalText}`;
  if (threshold === 100) {
    return `${emoji} <b>${name}</b> 이번 달 목표 달성! ${progress}`;
  }
  return `${emoji} <b>${name}</b> 이번 달 ${threshold}% 돌파! ${progress}`;
}
