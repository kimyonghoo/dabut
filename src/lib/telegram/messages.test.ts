import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  eventNotificationMessage,
  transactionNotificationMessage,
  paymentMethodMilestoneMessage,
  tomorrowDigestMessage,
} from "./messages";

describe("escapeHtml", () => {
  it("leaves plain text untouched", () => {
    expect(escapeHtml("외식 점심")).toBe("외식 점심");
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
    ).toBe("📅 <b>일정 등록</b>\n제목: 저녁 약속\n일시: 10월 20일 (화) 18:00\n등록: 민지님");
  });

  it("builds an all-day message without a time, marked (종일), but with the day of week", () => {
    expect(
      eventNotificationMessage({
        action: "updated",
        actorName: "민지",
        title: "출장",
        startAt: "2026-10-20T00:00:00.000Z",
        allDay: true,
      })
    ).toBe("📅 <b>일정 수정</b>\n제목: 출장\n일시: 10월 20일 (화) (종일)\n등록: 민지님");
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
    ).toBe("📅 <b>일정 등록</b>\n제목: 저녁 약속\n일시: 10월 20일 (화) 01:00\n등록: 민지님");
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
    ).toBe("📅 <b>일정 등록</b>\n제목: 저녁 약속\n일시: 10월 20일 (화) 09:00\n등록: 민지님");
  });

  it("builds a deleted message", () => {
    expect(
      eventNotificationMessage({
        action: "deleted",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("📅 <b>일정 삭제</b>\n제목: 저녁 약속\n일시: 10월 20일 (화) 18:00\n등록: 민지님");
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
      "📅 <b>일정 삭제</b>\n제목: &lt;script&gt;&amp;nbsp;&lt;/script&gt;\n일시: 10월 20일 (화) 18:00\n등록: &lt;b&gt;해커&lt;/b&gt;님"
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
        categoryName: "외식",
      })
    ).toBe("💸 <b>지출 발생</b>\n분류: 외식\n금액: 15,000원\n등록: 민지님");
  });

  it("includes the category icon next to the category name when present", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "외식",
        categoryIcon: "🍚",
      })
    ).toBe("💸 <b>지출 발생</b>\n분류: 🍚 외식\n금액: 15,000원\n등록: 민지님");
  });

  it("includes the payment method when present", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "외식",
        paymentMethodName: "삼성카드",
      })
    ).toBe("💸 <b>지출 발생</b>\n분류: 외식\n결제: 삼성카드\n금액: 15,000원\n등록: 민지님");
  });

  it("appends a memo line when present", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "외식",
        memo: "점심 김밥",
      })
    ).toBe("💸 <b>지출 발생</b>\n분류: 외식\n금액: 15,000원\n메모: 점심 김밥\n등록: 민지님");
  });

  it("omits the memo line entirely when memo is null, empty, or whitespace-only", () => {
    const base = {
      action: "created" as const,
      actorName: "민지",
      type: "expense" as const,
      amount: 15000,
      categoryName: "외식",
    };
    const expected = "💸 <b>지출 발생</b>\n분류: 외식\n금액: 15,000원\n등록: 민지님";
    expect(transactionNotificationMessage({ ...base, memo: null })).toBe(expected);
    expect(transactionNotificationMessage({ ...base, memo: "" })).toBe(expected);
    expect(transactionNotificationMessage({ ...base, memo: "   " })).toBe(expected);
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
    ).toBe("💰 <b>수입 수정</b>\n분류: 월급\n금액: 3,000,000원\n등록: 민지님");
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
    ).toBe("💸 <b>지출 삭제</b>\n분류: 문화\n금액: 12,000원\n등록: 민지님");
  });

  it("escapes HTML-special characters in actor name, category name, payment method, and a malicious memo", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지<i>",
        type: "expense",
        amount: 5000,
        categoryName: "기타&특별",
        paymentMethodName: "<b>해킹</b>카드",
        memo: '<script>alert("x")</script>',
      })
    ).toBe(
      "💸 <b>지출 발생</b>\n분류: 기타&amp;특별\n결제: &lt;b&gt;해킹&lt;/b&gt;카드\n금액: 5,000원\n메모: &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;\n등록: 민지&lt;i&gt;님"
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

describe("tomorrowDigestMessage", () => {
  it("lists tomorrow's timed events in order, with a date header", () => {
    expect(
      tomorrowDigestMessage({
        events: [
          { title: "회의", startAt: "2026-10-20T05:00:00.000Z", allDay: false, isMine: true }, // 14:00 KST
          { title: "치과 예약", startAt: "2026-10-19T23:00:00.000Z", allDay: false, isMine: true }, // 08:00 KST
        ],
      })
    ).toBe("📅 <b>내일 뭐해?</b>\n10월 20일 (화)\n\n👤 <b>나</b>\n08:00  치과 예약\n14:00  회의");
  });

  it("puts all-day events first, labeled 종일", () => {
    expect(
      tomorrowDigestMessage({
        events: [
          { title: "회의", startAt: "2026-10-20T05:00:00.000Z", allDay: false, isMine: true },
          { title: "생일", startAt: "2026-10-20T00:00:00.000Z", allDay: true, isMine: true },
        ],
      })
    ).toBe("📅 <b>내일 뭐해?</b>\n10월 20일 (화)\n\n👤 <b>나</b>\n종일  생일\n14:00  회의");
  });

  it("escapes HTML-special characters in event titles", () => {
    expect(
      tomorrowDigestMessage({
        events: [{ title: "<b>해킹</b>", startAt: "2026-10-20T05:00:00.000Z", allDay: false, isMine: true }],
      })
    ).toBe("📅 <b>내일 뭐해?</b>\n10월 20일 (화)\n\n👤 <b>나</b>\n14:00  &lt;b&gt;해킹&lt;/b&gt;");
  });

  it("groups events into 나 and the partner's section, with the partner's name", () => {
    expect(
      tomorrowDigestMessage({
        events: [
          { title: "회의", startAt: "2026-10-20T05:00:00.000Z", allDay: false, isMine: true },
          { title: "요가", startAt: "2026-10-19T23:00:00.000Z", allDay: false, isMine: false },
        ],
        partnerName: "지민",
      })
    ).toBe(
      "📅 <b>내일 뭐해?</b>\n10월 20일 (화)\n\n👤 <b>나</b>\n14:00  회의\n\n👥 <b>지민</b>\n08:00  요가"
    );
  });

  it("falls back to 상대방 when the partner has no display name", () => {
    expect(
      tomorrowDigestMessage({
        events: [{ title: "요가", startAt: "2026-10-19T23:00:00.000Z", allDay: false, isMine: false }],
      })
    ).toBe("📅 <b>내일 뭐해?</b>\n10월 20일 (화)\n\n👥 <b>상대방</b>\n08:00  요가");
  });
});
