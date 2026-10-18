"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

/**
 * Submit button for <form action={...}>: disables itself, shows a spinner
 * and drives the top progress bar while the form's action is pending.
 */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!pending) return;
    startProgress();
    return () => doneProgress();
  }, [pending]);

  return (
    <button
      type="submit"
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={buttonClass(variant, className)}
    >
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
