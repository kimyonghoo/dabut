import { BrandHero } from "@/components/auth/brand-hero";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-4 py-10">
      {/* soft decorative blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-soft blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-partner-soft blur-3xl"
      />
      <div className="relative flex w-full max-w-md flex-col gap-7">
        <BrandHero />
        {children}
      </div>
    </div>
  );
}
