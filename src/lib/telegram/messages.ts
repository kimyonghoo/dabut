import { format, parseISO } from "date-fns";

export type NotificationAction = "created" | "updated" | "deleted";

const EVENT_VERB: Record<NotificationAction, string> = {
  created: "등록했어요",
  updated: "수정했어요",
  deleted: "삭제했어요",
};

const TYPE_LABEL: Record<"expense" | "income", string> = {
  expense: "지출",
  income: "수입",
};

export function eventNotificationMessage(input: {
  action: NotificationAction;
  actorName: string;
  title: string;
  startAt: string;
  allDay: boolean;
}): string {
  const { action, actorName, title, startAt, allDay } = input;
  const head = `${actorName}님이 일정을 ${EVENT_VERB[action]}: ${title}`;
  if (action === "deleted") return head;
  const date = format(parseISO(startAt), allDay ? "M월 d일" : "M월 d일 HH:mm");
  return `${head} (${date})`;
}

export function transactionNotificationMessage(input: {
  action: NotificationAction;
  actorName: string;
  type: "expense" | "income";
  amount: number;
  categoryName: string;
}): string {
  const { action, actorName, type, amount, categoryName } = input;
  const amountText = `${amount.toLocaleString("ko-KR")}원`;
  const label = `${categoryName} ${TYPE_LABEL[type]}`;
  if (action === "created") return `${actorName}님이 ${label} ${amountText}을 등록했어요`;
  return `${actorName}님이 ${label} 내역을 ${EVENT_VERB[action]}: ${amountText}`;
}
