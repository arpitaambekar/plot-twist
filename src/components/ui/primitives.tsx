import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/80 transition-colors focus:border-accent focus:outline-none focus:ring-4 focus:ring-soft-blue",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-4 focus:ring-soft-blue",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-line bg-surface bg-[length:12px] bg-[right_12px_center] bg-no-repeat px-3.5 pr-9 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-soft-blue",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%23747D86' stroke-width='1.5'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ className, children, hint, ...props }: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string; hint?: string }) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...props}>
      {children}
      {hint && <span className="ml-1.5 font-normal text-muted">{hint}</span>}
    </label>
  );
}

type Tone = "neutral" | "blue" | "mint" | "peach" | "danger" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.05] text-ink/80",
  blue: "bg-soft-blue text-accent",
  mint: "bg-soft-mint text-mint-ink",
  peach: "bg-soft-peach text-peach-ink",
  danger: "bg-soft-danger text-danger",
  ink: "bg-ink text-white",
};

export function Badge({ tone = "neutral", className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5", tones[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-3 text-[16px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ title, kicker, action, className }: { title: string; kicker?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        {kicker && <p className="eyebrow mb-1.5">{kicker}</p>}
        <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <p className="text-[17px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "blue", title, children, action }: { tone?: "blue" | "peach" | "danger" | "mint"; title?: string; children?: ReactNode; action?: ReactNode }) {
  const map = { blue: "bg-soft-blue border-accent/15", peach: "bg-soft-peach border-peach-ink/15", danger: "bg-soft-danger border-danger/20", mint: "bg-soft-mint border-mint-ink/15" };
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", map[tone])} role="status">
      <div>
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className="text-ink/75">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-soft-pulse rounded-lg bg-ink/[0.06]", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}
