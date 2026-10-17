import { describe, it, expect } from "vitest";
import { eventNotificationMessage, transactionNotificationMessage } from "./messages";

describe("eventNotificationMessage", () => {
  it("builds a created message with a time for a timed event", () => {
    expect(
      eventNotificationMessage({
        action: "created",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("민지님이 일정을 등록했어요: 저녁 약속 (10월 20일 09:00)");
  });

  it("builds an all-day message without a time", () => {
    expect(
      eventNotificationMessage({
        action: "updated",
        actorName: "민지",
        title: "출장",
        startAt: "2026-10-20T00:00:00.000Z",
        allDay: true,
      })
    ).toBe("민지님이 일정을 수정했어요: 출장 (10월 20일)");
  });

  it("builds a deleted message without a date", () => {
    expect(
      eventNotificationMessage({
        action: "deleted",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("민지님이 일정을 삭제했어요: 저녁 약속");
  });
});

describe("transactionNotificationMessage", () => {
  it("builds a created message", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "식비",
      })
    ).toBe("민지님이 식비 지출 15,000원을 등록했어요");
  });

  it("builds an updated message", () => {
    expect(
      transactionNotificationMessage({
        action: "updated",
        actorName: "민지",
        type: "income",
        amount: 3000000,
        categoryName: "월급",
      })
    ).toBe("민지님이 월급 수입 내역을 수정했어요: 3,000,000원");
  });

  it("builds a deleted message", () => {
    expect(
      transactionNotificationMessage({
        action: "deleted",
        actorName: "민지",
        type: "expense",
        amount: 12000,
        categoryName: "문화",
      })
    ).toBe("민지님이 문화 지출 내역을 삭제했어요: 12,000원");
  });
});
