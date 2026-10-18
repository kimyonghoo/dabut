import { BrandHero } from "@/components/auth/brand-hero";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <BrandHero />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-7">{children}</div>
    </div>
  );
}
