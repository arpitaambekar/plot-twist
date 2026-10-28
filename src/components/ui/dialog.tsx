"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-fade-up" />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-6 shadow-[var(--shadow-lift)] focus:outline-none",
            wide ? "max-w-4xl" : "max-w-lg",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          {children}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Sheet({ open, onOpenChange, title, children, subtitle }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/20" />
        <D.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-[var(--shadow-lift)] focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <D.Title className="text-base font-semibold text-ink">{title}</D.Title>
              <D.Description className={subtitle ? "mt-0.5 text-[13px] text-muted" : "sr-only"}>{subtitle ?? title}</D.Description>
            </div>
            <D.Close className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
