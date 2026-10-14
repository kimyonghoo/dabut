import "./globals.css";

export const metadata = {
  title: "다붓 Dabut",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
