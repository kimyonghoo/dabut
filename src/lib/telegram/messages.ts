import { zonedDateParts, DEFAULT_TIMEZONE } from "@/lib/dates/timezone";

export type NotificationAction = "created" | "updated" | "deleted";

const TX_ACTION_NOUN: Record<NotificationAction, string> = {
  created: "발생",
  updated: "수정",
  deleted: "삭제",
};

const EVENT_ACTION_NOUN: Record<NotificationAction, string> = {
  created: "등록",
  updated: "수정",
  deleted: "삭제",
};

const TYPE_LABEL: Record<"expense" | "income", string> = {
  expense: "지출",
  income: "수입",
};

const TYPE_EMOJI: Record<"expense" | "income", string> = {
  expense: "💸",
  income: "💰",
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

function formatDateLabel(startAt: string, allDay: boolean, timeZone: string): string {
  const { month, day, hour, minute, weekday } = zonedDateParts(startAt, timeZone);
  const weekdayLabel = `(${KOREAN_WEEKDAYS[weekday]})`;
  return allDay
    ? `${month}월 ${day}일 ${weekdayLabel} (종일)`
    : `${month}월 ${day}일 ${weekdayLabel} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Rich, multi-line event notification (📅 일정 등록/수정/삭제 — title, when, who),
 * mirroring transactionNotificationMessage's field-per-line layout so every
 * Telegram push from this app reads the same way at a glance, not just a
 * single run-on sentence.
 */
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
  const name = escapeHtml(actorName);
  const safeTitle = escapeHtml(title);
  const lines = [
    `📅 <b>일정 ${EVENT_ACTION_NOUN[action]}</b>`,
    `제목: ${safeTitle}`,
    `일시: ${formatDateLabel(startAt, allDay, timeZone)}`,
    `등록: ${name}님`,
  ];
  return lines.join("\n");
}

export function transactionNotificationMessage(input: {
  action: NotificationAction;
  actorName: string;
  type: "expense" | "income";
  amount: number;
  categoryName: string;
  categoryIcon?: string | null;
  paymentMethodName?: string | null;
  memo?: string | null;
}): string {
  const { action, actorName, type, amount, categoryName, categoryIcon, paymentMethodName, memo } = input;
  const name = escapeHtml(actorName);
  const amountText = `${amount.toLocaleString("ko-KR")}원`;
  // lucide 아이콘 키(예: "soup")는 이름이 아니므로 표시하지 않고, 예전 이모지만 붙인다.
  const categoryLabel = categoryIcon && !/^[a-z0-9-]+$/i.test(categoryIcon)
    ? `${escapeHtml(categoryIcon)} ${escapeHtml(categoryName)}`
    : escapeHtml(categoryName);
  const trimmedMemo = memo?.trim();

  const lines = [
    `${TYPE_EMOJI[type]} <b>${TYPE_LABEL[type]} ${TX_ACTION_NOUN[action]}</b>`,
    `분류: ${categoryLabel}`,
  ];
  if (paymentMethodName) lines.push(`결제: ${escapeHtml(paymentMethodName)}`);
  lines.push(`금액: ${amountText}`);
  if (trimmedMemo) lines.push(`메모: ${escapeHtml(trimmedMemo)}`);
  lines.push(`등록: ${name}님`);
  return lines.join("\n");
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

export type TomorrowDigestEvent = {
  title: string;
  startAt: string;
  allDay: boolean;
  /** True when the recipient themself owns this event, false for a partner's shared event. */
  isMine: boolean;
  /** 같이 하는 일정(visibility=shared). 소유자와 상관없이 "OO랑 같이" 그룹으로 보낸다. */
  isShared?: boolean;
};

function sortDigestEvents(events: TomorrowDigestEvent[]): TomorrowDigestEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });
}

function digestEventLines(events: TomorrowDigestEvent[], timeZone: string): string[] {
  return sortDigestEvents(events).map((event) => {
    const { hour, minute } = zonedDateParts(event.startAt, timeZone);
    const time = event.allDay ? "종일" : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return `${time}  ${escapeHtml(event.title)}`;
  });
}

/**
 * "내일 뭐해?" daily digest — tomorrow's events for one user, sent the
 * evening before at their chosen hour. Events are grouped into "나" (the
 * recipient's own events) and the partner's shared events so it's clear at
 * a glance whose plan is whose, instead of one mixed list. Caller is
 * responsible for not invoking this (and not sending anything) when there
 * are no events; this builder always assumes there's at least one.
 */
export function tomorrowDigestMessage(input: {
  events: TomorrowDigestEvent[];
  timeZone?: string;
  partnerName?: string | null;
}): string {
  const { events, timeZone = DEFAULT_TIMEZONE, partnerName } = input;
  const sorted = sortDigestEvents(events);
  const { month, day, weekday } = zonedDateParts(sorted[0].startAt, timeZone);
  const lines = [`📅 <b>내일 뭐해?</b>`, `${month}월 ${day}일 (${KOREAN_WEEKDAYS[weekday]})`];

  const together = events.filter((event) => event.isShared);
  const mine = events.filter((event) => !event.isShared && event.isMine);
  const theirs = events.filter((event) => !event.isShared && !event.isMine);

  if (mine.length > 0) {
    lines.push("", "👤 <b>나</b>");
    lines.push(...digestEventLines(mine, timeZone));
  }
  if (together.length > 0) {
    lines.push("", `🤝 <b>${escapeHtml(partnerName?.trim() || "상대방")}랑 같이</b>`);
    lines.push(...digestEventLines(together, timeZone));
  }
  if (theirs.length > 0) {
    lines.push("", `👥 <b>${escapeHtml(partnerName?.trim() || "상대방")}</b>`);
    lines.push(...digestEventLines(theirs, timeZone));
  }

  return lines.join("\n");
}
