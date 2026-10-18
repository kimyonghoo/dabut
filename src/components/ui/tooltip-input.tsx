"use client";

import { forwardRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from "react";

/** One custom message per native validity failure we care about. */
export type TooltipMessages = {
  valueMissing?: string;
  typeMismatch?: string;
  tooShort?: string;
  tooLong?: string;
  patternMismatch?: string;
};

/**
 * Picks the message for the first validity flag that's set, in the order a
 * browser would report them. Returns undefined if nothing in `messages`
 * covers the failure (caller falls back to the input's own validationMessage).
 */
export function resolveValidityMessage(
  validity: Pick<ValidityState, "valueMissing" | "typeMismatch" | "tooShort" | "tooLong" | "patternMismatch">,
  messages: TooltipMessages | undefined
): string | undefined {
  if (!messages) return undefined;
  if (validity.valueMissing) return messages.valueMissing;
  if (validity.typeMismatch) return messages.typeMismatch;
  if (validity.tooShort) return messages.tooShort;
  if (validity.tooLong) return messages.tooLong;
  if (validity.patternMismatch) return messages.patternMismatch;
  return undefined;
}

type TooltipInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Custom copy for each kind of validity failure — replaces the browser's own wording. */
  messages?: TooltipMessages;
};

/**
 * A drop-in <input> that replaces the browser's native "please fill out this
 * field" bubble with our own small tooltip, styled consistently everywhere
 * it's used instead of looking different per browser/OS.
 */
export const TooltipInput = forwardRef<HTMLInputElement, TooltipInputProps>(function TooltipInput(
  { messages, onInvalid, onChange, className, ...props },
  ref
) {
  const [tip, setTip] = useState<string | null>(null);

  function handleInvalid(e: FormEvent<HTMLInputElement>) {
    e.preventDefault(); // suppress the browser's own bubble
    const el = e.currentTarget;
    setTip(resolveValidityMessage(el.validity, messages) ?? el.validationMessage);
    onInvalid?.(e);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (tip) setTip(null);
    onChange?.(e);
  }

  return (
    <div className="relative">
      {tip && (
        <div
          role="alert"
          className="absolute -top-8 left-0 z-10 flex items-center whitespace-nowrap rounded-lg bg-[#2c2320] px-2.5 py-1.5 text-[10.5px] font-semibold text-[#fdf6f0] shadow-lg after:absolute after:-bottom-1 after:left-3.5 after:size-2 after:rotate-45 after:bg-[#2c2320]"
        >
          {tip}
        </div>
      )}
      <input ref={ref} onInvalid={handleInvalid} onChange={handleChange} className={className} {...props} />
    </div>
  );
});
