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
