import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  eventNotificationMessage,
  transactionNotificationMessage,
  paymentMethodMilestoneMessage,
} from "./messages";

describe("escapeHtml", () => {
  it("leaves plain text untouched", () => {
    expect(escapeHtml("식비 점심")).toBe("식비 점심");
  });

  it("escapes &, <, > so arbitrary user text can't break Telegram HTML parsing", () => {
    expect(escapeHtml("<script>alert(1)</script> & co")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt; &amp; co"
    );
  });

  it("escapes quotes too", () => {
    expect(escapeHtml(`he said "hi" & 'bye'`)).toBe("he said &quot;hi&quot; &amp; &#39;bye&#39;");
  });
});

describe("eventNotificationMessage", () => {
  it("builds a created message with a time for a timed event, in the default Asia/Seoul timezone, with the Korean day of week", () => {
    // 2026-10-20T09:00:00Z is 18:00 KST the same calendar day (Tuesday).
    expect(
      eventNotificationMessage({
        action: "created",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("✅ <b>민지</b>님이 일정을 등록했어요: <b>저녁 약속</b> (10월 20일 (화) 18:00)");
  });

  it("builds an all-day message without a time, but with the day of week", () => {
    expect(
      eventNotificationMessage({
        action: "updated",
        actorName: "민지",
        title: "출장",
        startAt: "2026-10-20T00:00:00.000Z",
        allDay: true,
      })
    ).toBe("✏️ <b>민지</b>님이 일정을 수정했어요: <b>출장</b> (10월 20일 (화))");
  });

  it("uses the event owner's timezone to resolve the calendar day, rolling into the next day (and its weekday) when appropriate", () => {
    // 2026-10-19T16:00:00Z is 2026-10-20T01:00 KST — a different calendar day
    // (and weekday) than the UTC instant's own date. This is exactly the bug
    // this fix targets: naive UTC formatting would have shown Oct 19 (Mon).
    expect(
      eventNotificationMessage({
        action: "created",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-19T16:00:00.000Z",
        allDay: false,
      })
    ).toBe("✅ <b>민지</b>님이 일정을 등록했어요: <b>저녁 약속</b> (10월 20일 (화) 01:00)");
  });

  it("honors an explicit timeZone instead of the Asia/Seoul default", () => {
    expect(
      eventNotificationMessage({
        action: "created",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
        timeZone: "UTC",
      })
    ).toBe("✅ <b>민지</b>님이 일정을 등록했어요: <b>저녁 약속</b> (10월 20일 (화) 09:00)");
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
    ).toBe("🗑️ <b>민지</b>님이 일정을 삭제했어요: <b>저녁 약속</b>");
  });

  it("escapes HTML-special characters in the actor name and title", () => {
    expect(
      eventNotificationMessage({
        action: "deleted",
        actorName: "<b>해커</b>",
        title: "<script>&nbsp;</script>",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe(
      "🗑️ <b>&lt;b&gt;해커&lt;/b&gt;</b>님이 일정을 삭제했어요: <b>&lt;script&gt;&amp;nbsp;&lt;/script&gt;</b>"
    );
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
    ).toBe("✅ <b>민지</b>님이 식비 지출 <b>15,000원</b>을 등록했어요");
  });

  it("includes the category icon next to the category name when present", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "식비",
        categoryIcon: "🍚",
      })
    ).toBe("✅ <b>민지</b>님이 🍚 식비 지출 <b>15,000원</b>을 등록했어요");
  });

  it("appends the memo when present", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "식비",
        memo: "점심 김밥",
      })
    ).toBe("✅ <b>민지</b>님이 식비 지출 <b>15,000원</b>을 등록했어요 — 점심 김밥");
  });

  it("omits the memo suffix entirely when memo is null, empty, or whitespace-only", () => {
    const base = {
      action: "created" as const,
      actorName: "민지",
      type: "expense" as const,
      amount: 15000,
      categoryName: "식비",
    };
    expect(transactionNotificationMessage({ ...base, memo: null })).toBe(
      "✅ <b>민지</b>님이 식비 지출 <b>15,000원</b>을 등록했어요"
    );
    expect(transactionNotificationMessage({ ...base, memo: "" })).toBe(
      "✅ <b>민지</b>님이 식비 지출 <b>15,000원</b>을 등록했어요"
    );
    expect(transactionNotificationMessage({ ...base, memo: "   " })).toBe(
      "✅ <b>민지</b>님이 식비 지출 <b>15,000원</b>을 등록했어요"
    );
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
    ).toBe("✏️ <b>민지</b>님이 월급 수입 내역을 수정했어요: <b>3,000,000원</b>");
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
    ).toBe("🗑️ <b>민지</b>님이 문화 지출 내역을 삭제했어요: <b>12,000원</b>");
  });

  it("escapes HTML-special characters in actor name, category name, and a malicious memo", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지<i>",
        type: "expense",
        amount: 5000,
        categoryName: "기타&특별",
        memo: '<script>alert("x")</script>',
      })
    ).toBe(
      "✅ <b>민지&lt;i&gt;</b>님이 기타&amp;특별 지출 <b>5,000원</b>을 등록했어요 — &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});

describe("paymentMethodMilestoneMessage", () => {
  it("builds a 50% progress message", () => {
    expect(
      paymentMethodMilestoneMessage({ threshold: 50, cardName: "신한카드", spent: 150_000, goal: 300_000 })
    ).toBe("🔸 <b>신한카드</b> 이번 달 50% 돌파! 150,000원 / 300,000원");
  });

  it("builds an 80% progress message with a different emoji than 50%", () => {
    expect(
      paymentMethodMilestoneMessage({ threshold: 80, cardName: "신한카드", spent: 240_000, goal: 300_000 })
    ).toBe("🔶 <b>신한카드</b> 이번 달 80% 돌파! 240,000원 / 300,000원");
  });

  it("builds a distinct, celebratory 100%+ achievement message (not a warning)", () => {
    const message = paymentMethodMilestoneMessage({
      threshold: 100,
      cardName: "신한카드",
      spent: 310_000,
      goal: 300_000,
    });
    expect(message).toBe("🎉 <b>신한카드</b> 이번 달 목표 달성! 310,000원 / 300,000원");
    // Celebratory tone: distinct emoji and wording from the 50/80 progress
    // messages, never "돌파" (lit. "broke through"/exceeded, which reads as
    // a warning) for the achievement case.
    expect(message).not.toContain("돌파");
  });

  it("escapes HTML-special characters in the card name", () => {
    expect(
      paymentMethodMilestoneMessage({
        threshold: 50,
        cardName: "<b>해커</b>카드 & co",
        spent: 1000,
        goal: 2000,
      })
    ).toBe("🔸 <b>&lt;b&gt;해커&lt;/b&gt;카드 &amp; co</b> 이번 달 50% 돌파! 1,000원 / 2,000원");
  });
});
