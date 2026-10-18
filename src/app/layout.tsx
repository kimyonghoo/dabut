import type { Viewport } from "next";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TopProgress } from "@/components/feedback/top-progress";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf5" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1715" },
  ],
};

/**
 * True root layout — outside the [locale] segment on purpose. Switching
 * locale only swaps the segment below this, so <html>/<body>, the theme
 * provider and the progress bar all stay mounted instead of flashing on
 * every language change.
 *
 * Toaster is NOT rendered here even though it's also locale-independent in
 * spirit: it calls useTranslations, which needs NextIntlClientProvider —
 * that only wraps [locale]/layout.tsx's children, not this root. It's
 * rendered there instead.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-ink antialiased [-webkit-tap-highlight-color:transparent] selection:bg-brand-soft">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TopProgress />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
