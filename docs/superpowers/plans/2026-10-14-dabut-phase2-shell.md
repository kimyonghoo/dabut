# Dabut Phase 2 — Next.js Shell, i18n, Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the bare Next.js scaffold from Phase 1 into a navigable app shell: three-language routing, a light/dark theme with a per-user dynamic brand color, and a swipeable bottom-tab layout (일정 ↔ 가계부) sitting behind a minimal email/password auth gate.

**Architecture:** `next-intl` owns locale routing via a `[locale]` App Router segment and a combined middleware (locale resolution + the existing Supabase session refresh). `next-themes` owns light/dark; a small custom `BrandColorProvider` owns the per-user accent color as a CSS custom property that a Tailwind v4 `@theme` token reads through (`--color-brand: var(--brand-color, #FF6F61)`), so `bg-brand`/`text-brand` utilities stay static at build time while the color itself is runtime-overridable. A protected `(app)` route group gates `/calendar`, `/ledger`, and `/settings` behind a session check; `(auth)` holds login/signup. Tab switching is driven by a small pure function (`resolveSwipeDirection`) wired to a Framer Motion drag handler, so the swipe *decision* is unit-testable independent of gesture simulation.

**Tech Stack:** next-intl 4.14.9, next-themes 0.4.6, framer-motion 14.2.0, tailwindcss 4.3.3 + @tailwindcss/postcss 4.3.3, Vitest 5.0.4 + @testing-library/react 16.3.3 + @testing-library/jest-dom 7.0.1 + jsdom 30.1.2 (all versions confirmed current via `npm view` on 2026-10-14).

**Spec:** `D:\Dabut\requirements.md` — this plan implements §3.4 (navigation/gesture, theme, dynamic brand color), §3.5 (i18n), and requirements.md §4's Phase 2 bullet list. §3.2/§3.3 (actual calendar/ledger CRUD) are Phase 3 and get placeholder pages only; §3.1's "이메일 정확도 검색" invite flow and 텔레그램 연동 are Phase 3/4 and are out of scope — this plan's auth pages are a minimal email/password gate, nothing more.

## Global Constraints

- Supported locales: 한국어(ko, default), 영어(en), 중국어(zh) — requirements.md §3.5.
- Light/Dark 완벽 지원 + 사용자가 직접 지정하는 브랜드 컬러 — requirements.md §3.4.
- 하단 탭 바 + 좌우 스와이프로 일정 ↔ 가계부 전환 — requirements.md §3.4.
- `profiles.brand_color` (default `'#FF6F61'`) and `profiles.locale` already exist in the DB (Phase 1); this plan reads `brand_color` but does not yet sync `locale` (declined — see below).
- No calendar/ledger business logic, no Telegram, no Realtime in this plan (Phase 3/4).

## Review Focus

- A `profiles` query that returns no row or a null `brand_color` for any reason (the trigger is synchronous so this shouldn't happen in practice, but the fetch is defensive regardless) — must fall back to the DB default (`#FF6F61`) rather than rendering an empty/invalid CSS color.
- Direct navigation to a protected URL (`/calendar`, `/ledger`, `/settings`) with no session — must redirect to `/login` (locale-prefixed), not render the page then fail.
- A swipe gesture too small or too slow to count as intentional (e.g. a vertical scroll that also drifts horizontally a few pixels) — must not trigger a tab switch.
- Requesting a locale outside `['ko','en','zh']` (e.g. `/fr/calendar`) — must not 500; next-intl's own 404 behavior for unknown locales is acceptable, but confirm it doesn't crash the middleware.
- Switching theme or brand color must not require a page reload to take visual effect (both are runtime CSS, not a rebuild) — confirmed by the component tests reading the live DOM state after interaction, not just initial render.

---

## Task 1: Testing Infrastructure (Vitest + React Testing Library)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/lib/testing/sum.ts` (throwaway smoke-test subject, deleted at the end of this task once the harness is proven — see Step 5)
- Modify: `package.json` (add `test` script + new devDependencies)

**Interfaces:**
- Produces: `npm test` running Vitest in jsdom mode with `@testing-library/jest-dom` matchers available globally — every later task's `*.test.ts(x)` files run under this.

- [ ] **Step 1: Add dependencies to `package.json` devDependencies**

```json
"vitest": "^5.0.4",
"@testing-library/react": "^16.3.3",
"@testing-library/jest-dom": "^7.0.1",
"@testing-library/user-event": "^14.5.2",
"jsdom": "^30.1.2",
"@vitejs/plugin-react": "^6.1.2"
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write a throwaway smoke test to prove the harness works**

`src/lib/testing/sum.ts`:
```typescript
export function sum(a: number, b: number): number {
  return a + b;
}
```

`src/lib/testing/sum.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { sum } from "./sum";

describe("sum", () => {
  it("adds two numbers", () => {
    expect(sum(2, 3)).toBe(5);
  });
});
```

Run: `npm install && npm test`
Expected: `npm test` reports 1 passed test.

- [ ] **Step 5: Delete the throwaway smoke test**

Remove `src/lib/testing/sum.ts` and `src/lib/testing/sum.test.ts` (and the now-empty `src/lib/testing/` directory) — they existed only to prove Step 4's harness works, not as a permanent fixture.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts vitest.setup.ts package-lock.json
git commit -m "chore: add Vitest + React Testing Library"
```

---

## Task 2: Tailwind v4 Migration

**Files:**
- Modify: `package.json` (bump `tailwindcss`, add `@tailwindcss/postcss`, remove `autoprefixer` and the standalone `postcss` devDependency — v4's PostCSS plugin bundles both)
- Modify: `postcss.config.mjs`
- Modify: `src/app/globals.css`
- Delete: `tailwind.config.ts` (Tailwind v4 has no required JS config file; content detection is automatic)

**Interfaces:**
- Produces: the `--color-brand` CSS theme token (defaulting to `var(--brand-color, #FF6F61)`) and its generated utilities (`bg-brand`, `text-brand`, `border-brand`, etc.) — Task 5's `BrandColorProvider` sets the `--brand-color` custom property these utilities read through.

- [ ] **Step 1: Update `package.json`**

Replace in `devDependencies`: `"tailwindcss": "^4.3.3"`, `"@tailwindcss/postcss": "^4.3.3"`. Remove `"autoprefixer"` and `"postcss"` (bundled into `@tailwindcss/postcss` in v4).

- [ ] **Step 2: Rewrite `postcss.config.mjs`**

```javascript
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

export default config;
```

- [ ] **Step 3: Rewrite `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-brand: var(--brand-color, #FF6F61);
}
```

- [ ] **Step 4: Delete `tailwind.config.ts`**

- [ ] **Step 5: Prove the v4 pipeline actually compiles a utility class**

Temporarily add `className="bg-brand"` to the element in `src/app/page.tsx` (or `src/app/[locale]/page.tsx` if Task 3 has already run first — use whichever exists at this point in execution order).

Run: `npm install && npm run build`
Expected: exits 0, and `grep -r "color-brand" .next/static/css/*.css` (or equivalent glob under `.next/static/css/`) finds the generated rule, proving Tailwind v4 picked up the `@theme` token and the `bg-brand` utility exists in compiled output — not just that the build didn't error.

Revert the temporary `className` addition once confirmed (Task 7/8 will use `bg-brand` for real in the tab bar).

- [ ] **Step 6: Commit**

```bash
git add package.json postcss.config.mjs src/app/globals.css package-lock.json
git rm tailwind.config.ts
git commit -m "chore: migrate Tailwind CSS v3 -> v4"
```

---

## Task 3: i18n Routing (next-intl) + Locale Restructuring

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/navigation.ts`
- Create: `src/i18n/request.ts`
- Create: `messages/ko.json`, `messages/en.json`, `messages/zh.json`
- Create: `src/app/[locale]/layout.tsx` (replaces `src/app/layout.tsx`)
- Create: `src/app/[locale]/page.tsx` (replaces `src/app/page.tsx`)
- Delete: `src/app/layout.tsx`, `src/app/page.tsx`
- Modify: `src/middleware.ts`
- Modify: `next.config.ts` (next-intl requires wrapping the config with its plugin)

**Interfaces:**
- Produces: `routing` (from `src/i18n/routing.ts`, locales `['ko','en','zh']`, `defaultLocale: 'ko'`) and `{ Link, redirect, usePathname, useRouter }` (from `src/i18n/navigation.ts`) — every later task's navigation/redirect code imports these instead of `next/navigation` directly, so locale prefixes are never hand-rolled.
- Consumes: `updateSession` from `src/lib/supabase/middleware.ts` (Task 2 of the Phase 1 plan) — composed into the new combined middleware.

- [ ] **Step 1: Add `next-intl` to `package.json` dependencies**

`"next-intl": "^4.14.9"`. Run `npm install`.

- [ ] **Step 2: Write `src/i18n/routing.ts`**

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en", "zh"],
  defaultLocale: "ko",
});
```

- [ ] **Step 3: Write `src/i18n/navigation.ts`**

```typescript
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Write `src/i18n/request.ts`**

```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Write the three message files**

Each of `messages/ko.json`, `messages/en.json`, `messages/zh.json` needs exactly these keys (translate values appropriately per locale; ko values shown as reference):

```json
{
  "app": { "name": "다붓", "tagline": "함께 붙어, 다정하게" },
  "nav": { "calendar": "일정", "ledger": "가계부", "settings": "설정" },
  "auth": {
    "login": { "title": "로그인", "email": "이메일", "password": "비밀번호", "submit": "로그인" },
    "signup": { "title": "회원가입", "email": "이메일", "password": "비밀번호", "submit": "가입하기" }
  },
  "theme": { "light": "라이트", "dark": "다크" }
}
```

- [ ] **Step 6: Wrap `next.config.ts` with next-intl's plugin**

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Move the root layout and page under `[locale]`**

Delete `src/app/layout.tsx` and `src/app/page.tsx`. Create `src/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Create `src/app/[locale]/page.tsx` — a placeholder for now (Task 8 replaces its body with the real redirect-to-calendar logic once the protected layout exists):

```tsx
export default function Home() {
  return <main>다붓 (Dabut) — Phase 2 scaffold</main>;
}
```

- [ ] **Step 8: Compose the middleware**

Rewrite `src/middleware.ts` to run both the Supabase session refresh (`updateSession`, already in `src/lib/supabase/middleware.ts`) and next-intl's locale middleware against the same request, returning one merged `NextResponse` that carries next-intl's locale rewrite/redirect *and* any `Set-Cookie` headers `updateSession` produced. Check `next-intl`'s actual current `createMiddleware` signature (v4.14.9 — confirm against its installed `.d.ts` or docs, since APIs shift between majors) rather than assuming an older version's exact call shape; the two concrete things to verify afterward are in Step 9.

- [ ] **Step 9: Verify locale routing and session refresh both work**

Run: `npm run build && npm start` (or `npm run dev` in a separate terminal), then:
- `curl -sI http://localhost:3000/` — Expected: a 307/308 redirect to `/` serving the `ko` locale's content (default locale, no visible prefix) or an explicit `/ko` redirect, depending on the `localePrefix` behavior next-intl defaults to — confirm which and note it in the commit message.
- `curl -sI http://localhost:3000/en` — Expected: 200, English messages loaded (spot-check by curling the HTML body for `"app.tagline"`'s English value).
- Confirm no 500s for `curl -sI http://localhost:3000/fr` (an unsupported locale) — next-intl's own 404 is acceptable (Review Focus item).

- [ ] **Step 10: Commit**

```bash
git add src/i18n messages src/app/\[locale\] src/middleware.ts next.config.ts package.json package-lock.json
git rm src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add next-intl locale routing (ko/en/zh)"
```

---

## Task 4: Theme System (Light/Dark)

**Files:**
- Create: `src/components/theme/theme-provider.tsx`
- Create: `src/components/theme/theme-toggle.tsx`
- Create: `src/components/theme/theme-toggle.test.tsx`
- Modify: `src/app/[locale]/layout.tsx` (wrap children in `ThemeProvider`)

**Interfaces:**
- Produces: `<ThemeProvider>` (wraps `next-themes`' provider, `attribute="class"`, `defaultTheme="system"`, `enableSystem`) and `<ThemeToggle>` (a button cycling light → dark → light) — Task 8's settings page renders `<ThemeToggle>`.

- [ ] **Step 1: Write the failing test for `ThemeToggle`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("toggles the html class between light and dark on click", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(document.documentElement).toHaveClass("light");
    await user.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveClass("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme-toggle`
Expected: FAIL — `theme-provider`/`theme-toggle` modules not found.

- [ ] **Step 3: Add `next-themes` to `package.json` dependencies**

`"next-themes": "^0.4.6"`. Run `npm install`.

- [ ] **Step 4: Write `src/components/theme/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 5: Write `src/components/theme/theme-toggle.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");

  return (
    <button
      type="button"
      aria-label={resolvedTheme === "dark" ? t("light") : t("dark")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
```

Note: this makes `ThemeToggle` depend on `NextIntlClientProvider` being an ancestor — in the Step 1 test above it isn't, so wrap the test's render in `NextIntlClientProvider` with a minimal `{ theme: { light: "Light", dark: "Dark" } }` messages object, or the component throws. Adjust Step 1's test render accordingly before running Step 2.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- theme-toggle`
Expected: PASS.

- [ ] **Step 7: Wrap `src/app/[locale]/layout.tsx`'s children in `ThemeProvider`**

Inside `<body>`, nest: `<ThemeProvider attribute="class" defaultTheme="system" enableSystem><NextIntlClientProvider ...>{children}</NextIntlClientProvider></ThemeProvider>`.

- [ ] **Step 8: Run full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass, build exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/theme src/app/\[locale\]/layout.tsx package.json package-lock.json
git commit -m "feat: add light/dark theme via next-themes"
```

---

## Task 5: Dynamic Brand Color

**Files:**
- Create: `src/components/theme/brand-color-provider.tsx`
- Create: `src/components/theme/brand-color-provider.test.tsx`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/client.ts` (Phase 1 Task 2); `Database["public"]["Tables"]["profiles"]["Row"]["brand_color"]` type (Phase 1 Task 8).
- Produces: `<BrandColorProvider initialColor={string}>` and `useBrandColor(): { brandColor: string; setBrandColor: (color: string) => void }` — Task 8's settings page reads/writes through this hook, and `(app)/layout.tsx` renders the provider with the signed-in user's `profiles.brand_color` (fetched server-side) as `initialColor`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandColorProvider, useBrandColor } from "./brand-color-provider";

function Probe() {
  const { brandColor, setBrandColor } = useBrandColor();
  return (
    <button onClick={() => setBrandColor("#00FF00")}>{brandColor}</button>
  );
}

describe("BrandColorProvider", () => {
  it("sets the --brand-color CSS variable from initialColor on mount", () => {
    render(
      <BrandColorProvider initialColor="#FF6F61">
        <Probe />
      </BrandColorProvider>
    );
    expect(document.documentElement.style.getPropertyValue("--brand-color")).toBe("#FF6F61");
  });

  it("updates the CSS variable and context value when setBrandColor is called", () => {
    render(
      <BrandColorProvider initialColor="#FF6F61">
        <Probe />
      </BrandColorProvider>
    );
    act(() => screen.getByRole("button").click());
    expect(document.documentElement.style.getPropertyValue("--brand-color")).toBe("#00FF00");
    expect(screen.getByRole("button")).toHaveTextContent("#00FF00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- brand-color-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `BrandColorProvider` / `useBrandColor` in `src/components/theme/brand-color-provider.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type BrandColorContextValue = {
  brandColor: string;
  setBrandColor: (color: string) => void;
};

const BrandColorContext = createContext<BrandColorContextValue | null>(null);

export function BrandColorProvider({
  initialColor,
  children,
}: {
  initialColor: string;
  children: ReactNode;
}) {
  const [brandColor, setBrandColor] = useState(initialColor);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-color", brandColor);
  }, [brandColor]);

  return (
    <BrandColorContext.Provider value={{ brandColor, setBrandColor }}>
      {children}
    </BrandColorContext.Provider>
  );
}

export function useBrandColor(): BrandColorContextValue {
  const ctx = useContext(BrandColorContext);
  if (!ctx) throw new Error("useBrandColor must be used within a BrandColorProvider");
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- brand-color-provider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/brand-color-provider.tsx src/components/theme/brand-color-provider.test.tsx
git commit -m "feat: add dynamic brand-color context"
```

---

## Task 6: Auth Gate (Login/Signup + Protected Layout)

**Files:**
- Create: `src/app/[locale]/(auth)/login/page.tsx`
- Create: `src/app/[locale]/(auth)/signup/page.tsx`
- Create: `src/app/[locale]/(app)/layout.tsx`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/client.ts` (browser, for the login/signup forms) and `src/lib/supabase/server.ts` (server, for the session check); `redirect` from `src/i18n/navigation.ts` (Task 3) — locale-aware, not `next/navigation`'s.
- Produces: the `(app)` route group — Task 8's calendar/ledger/settings pages live inside it and can assume a session exists by the time they render.

- [ ] **Step 1: Write `src/app/[locale]/(auth)/login/page.tsx`**

Client component. A form with email + password fields (`useTranslations("auth.login")` for labels/title/submit text from Task 3's message keys), calling `createClient().auth.signInWithPassword({ email, password })` on submit; on success, `router.push` (from `src/i18n/navigation.ts`) to `/calendar`; on error, render `error.message` in the form.

- [ ] **Step 2: Write `src/app/[locale]/(auth)/signup/page.tsx`**

Same shape as login, using `auth.signup` message keys, calling `createClient().auth.signUp({ email, password })`. On success (Supabase sends a confirmation email per `supabase/config.toml`'s `enable_confirmations = true`), render a "check your email" message rather than redirecting — there is no session yet until the user confirms.

- [ ] **Step 3: Write `src/app/[locale]/(app)/layout.tsx`**

Server component. Use `createClient()` from `src/lib/supabase/server.ts` to call `auth.getUser()`; if no user, `redirect("/login")` (from `src/i18n/navigation.ts`). If a user exists, fetch their `profiles.brand_color` in the same request and render:

```tsx
<BrandColorProvider initialColor={profile?.brand_color ?? "#FF6F61"}>
  {children}
</BrandColorProvider>
```

(Task 8 adds the `TabBar`/`SwipeableTabs` wrapper around `{children}` here too — this task only needs the auth gate + brand color wiring in place so Task 7/8 have something to attach to.)

- [ ] **Step 4: Verify the auth gate manually**

Run: `npm run build && npm start`, then `curl -sI http://localhost:3000/calendar` (no cookies)
Expected: a redirect response pointing at `/login` (Review Focus item — confirms unauthenticated access to a protected route never renders the page).

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/\(auth\) src/app/\[locale\]/\(app\)
git commit -m "feat: add login/signup pages and protected app layout"
```

---

## Task 7: Swipeable Tab Navigation

**Files:**
- Create: `src/components/navigation/resolve-swipe-direction.ts`
- Create: `src/components/navigation/resolve-swipe-direction.test.ts`
- Create: `src/components/navigation/tab-bar.tsx`
- Create: `src/components/navigation/swipeable-tabs.tsx`

**Interfaces:**
- Produces: `resolveSwipeDirection(offsetX: number, velocityX: number): "next" | "prev" | null` (pure; `"next"` = 가계부 follows 일정, `"prev"` = the reverse); `<TabBar activeTab={"calendar" | "ledger"} />` (uses `Link`/`usePathname` from `src/i18n/navigation.ts`, `useTranslations("nav")` for labels, `bg-brand` utility from Task 2 to highlight the active tab); `<SwipeableTabs>{children}</SwipeableTabs>` (wraps a Framer Motion `motion.div drag="x"`, calls `resolveSwipeDirection` in its `onDragEnd` and `router.push`-es to the sibling route). Task 8 renders both inside `(app)/layout.tsx`.

- [ ] **Step 1: Write the failing test for `resolveSwipeDirection`**

```typescript
import { describe, it, expect } from "vitest";
import { resolveSwipeDirection } from "./resolve-swipe-direction";

describe("resolveSwipeDirection", () => {
  it("returns 'next' for a decisive leftward swipe", () => {
    expect(resolveSwipeDirection(-100, -600)).toBe("next");
  });

  it("returns 'prev' for a decisive rightward swipe", () => {
    expect(resolveSwipeDirection(100, 600)).toBe("prev");
  });

  it("returns null for a small drift below the offset and velocity thresholds", () => {
    expect(resolveSwipeDirection(10, 50)).toBeNull();
  });

  it("returns 'next' when offset is small but velocity is decisively fast", () => {
    expect(resolveSwipeDirection(-20, -600)).toBe("next");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resolve-swipe-direction`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolveSwipeDirection` in `src/components/navigation/resolve-swipe-direction.ts`**

```typescript
const OFFSET_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

export function resolveSwipeDirection(offsetX: number, velocityX: number): "next" | "prev" | null {
  const decisive = Math.abs(offsetX) > OFFSET_THRESHOLD || Math.abs(velocityX) > VELOCITY_THRESHOLD;
  if (!decisive) return null;
  return offsetX < 0 || velocityX < 0 ? "next" : "prev";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- resolve-swipe-direction`
Expected: PASS.

- [ ] **Step 5: Add `framer-motion` to `package.json` dependencies**

`"framer-motion": "^14.2.0"`. Run `npm install`.

- [ ] **Step 6: Write `src/components/navigation/tab-bar.tsx`**

Client component rendering two `Link`s (from `src/i18n/navigation.ts`) to `/calendar` and `/ledger`, labeled via `useTranslations("nav")`, with the tab matching `usePathname()` getting a `bg-brand` (or `text-brand`) class for the active state.

- [ ] **Step 7: Write `src/components/navigation/swipeable-tabs.tsx`**

Client component: a `motion.div` with `drag="x"`, `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={0.2}`, whose `onDragEnd={(event, info) => { const dir = resolveSwipeDirection(info.offset.x, info.velocity.x); if (dir === "next" && pathname.endsWith("/calendar")) router.push("/ledger"); if (dir === "prev" && pathname.endsWith("/ledger")) router.push("/calendar"); }}` (using `usePathname`/`useRouter` from `src/i18n/navigation.ts`). Renders `{children}` inside the `motion.div`.

- [ ] **Step 8: Run full suite**

Run: `npm test`
Expected: all tests pass (no new failures from Steps 6-7's components, which have no dedicated tests per this task — their logic lives in the already-tested `resolveSwipeDirection`).

- [ ] **Step 9: Commit**

```bash
git add src/components/navigation package.json package-lock.json
git commit -m "feat: add swipeable tab navigation"
```

---

## Task 8: Wire the App Shell Together

**Files:**
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Create: `src/app/[locale]/(app)/calendar/page.tsx`
- Create: `src/app/[locale]/(app)/ledger/page.tsx`
- Create: `src/app/[locale]/(app)/settings/page.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `<TabBar>`/`<SwipeableTabs>` (Task 7), `<ThemeToggle>` (Task 4), `useBrandColor()` (Task 5) — this task is pure assembly, no new interfaces of its own.

- [ ] **Step 1: Finish `src/app/[locale]/(app)/layout.tsx`**

Inside the `BrandColorProvider` from Task 6 Step 3, render: `<SwipeableTabs>{children}</SwipeableTabs><TabBar activeTab={...} />` — determine `activeTab` from the current pathname (`"calendar"` or `"ledger"`; default to `"calendar"` for `/settings`, which isn't a swipeable tab).

- [ ] **Step 2: Write placeholder pages**

`src/app/[locale]/(app)/calendar/page.tsx`: `export default function CalendarPage() { return <main>일정 (Phase 3)</main>; }`
`src/app/[locale]/(app)/ledger/page.tsx`: `export default function LedgerPage() { return <main>가계부 (Phase 3)</main>; }`

- [ ] **Step 3: Write `src/app/[locale]/(app)/settings/page.tsx`**

Client component rendering `<ThemeToggle />` and a brand-color `<input type="color">` wired to `useBrandColor()`'s `setBrandColor`, whose `onChange` also calls `createClient().from("profiles").update({ brand_color: value }).eq("id", userId)` to persist it (fetch the signed-in `userId` via `createClient().auth.getUser()` on mount).

- [ ] **Step 4: Replace `src/app/[locale]/page.tsx`'s body with a redirect**

```tsx
import { redirect } from "@/i18n/navigation";

export default function Home() {
  redirect("/calendar");
}
```

(Unauthenticated users hitting `/calendar` get bounced to `/login` by the `(app)` layout's own check from Task 6 — this page doesn't need to duplicate that logic.)

- [ ] **Step 5: Run full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass, build exits 0.

- [ ] **Step 6: Manual verification of the whole shell**

Run: `npm run dev`, then in a browser: visit `/`, confirm redirect through to `/login` (no session) or `/calendar` (with a session created via Task 6's signup flow); on `/calendar`, confirm the tab bar renders, dragging left/right switches to `/ledger` and back, `/settings`'s theme toggle flips dark/light instantly, and changing the brand color swatch changes the active tab's highlight color instantly (both without a page reload — Review Focus item).

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]
git commit -m "feat: assemble app shell — tabs, placeholders, settings"
```
