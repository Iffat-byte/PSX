"use client";

import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Database, Info, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tone } from "@/lib/format";

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }>(
  function Button({ className, variant = "secondary", size = "md", loading, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
          size === "sm" && "h-8 px-3 text-xs",
          size === "md" && "h-10 px-4 text-sm",
          size === "lg" && "h-12 px-6 text-sm",
          size === "icon" && "h-9 w-9",
          variant === "primary" && "bg-accent text-accent-fg shadow-[0_6px_20px_-8px_rgb(var(--accent)/0.6)] hover:brightness-110",
          variant === "secondary" && "border border-border bg-surface-2 text-fg hover:bg-surface-3",
          variant === "outline" && "border border-border text-fg hover:border-accent/50 hover:bg-surface-2",
          variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
          variant === "danger" && "bg-loss/90 text-white hover:bg-loss",
          className,
        )}
        {...props}
      >
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {children}
      </button>
    );
  },
);

/* ------------------------------------------------------------------ Card */

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Badge */

export function Badge({ children, tone: t = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "amber" | "gain" | "loss" | "info"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        t === "neutral" && "bg-surface-3 text-muted",
        t === "accent" && "bg-accent/12 text-accent",
        t === "amber" && "bg-amber/12 text-amber",
        t === "gain" && "bg-gain/12 text-gain",
        t === "loss" && "bg-loss/12 text-loss",
        t === "info" && "bg-info/12 text-info",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <Badge tone="amber">
      <Database className="h-3 w-3" /> {label}
    </Badge>
  );
}

/** Source + timestamp footer shown under every data widget. */
export function SourceNote({ source, asOf, className }: { source: string; asOf?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] text-subtle", className)}>
      <Info className="h-3 w-3" />
      <span>
        Source: {source}
        {asOf && <> · As of {asOf}</>}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ Delta */

export function Delta({ value, children, className, icon = true }: { value: number | null | undefined; children: ReactNode; className?: string; icon?: boolean }) {
  const t = tone(value);
  const I = t === "gain" ? ArrowUpRight : t === "loss" ? ArrowDownRight : Minus;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 font-medium", t === "gain" && "text-gain", t === "loss" && "text-loss", t === "flat" && "text-muted", className)}>
      {icon && <I className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Field({ label, hint, error, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && <label htmlFor={htmlFor} className="label">{label}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-loss">{error}</p> : hint ? <p className="mt-1 text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn("field", p.type === "number" && "num", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={3} className={cn("field resize-y", className)} {...p} />;
});

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn("field appearance-none pr-9", className)} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

/** Number input that keeps a string while typing, emitting numbers. */
export function NumberInput({ value, onChange, min, step = "any", className, suffix, prefix, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number; onChange: (n: number) => void; suffix?: string; prefix?: string }) {
  const [text, setText] = useState(String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(Number.isFinite(value) ? String(value) : "");
      last.current = value;
    }
  }, [value]);
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-subtle">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.value === "" ? 0 : Number(e.target.value);
          if (Number.isFinite(n)) {
            last.current = n;
            onChange(n);
          }
        }}
        className={cn("field num", prefix && "pl-9", suffix && "pr-10", className)}
        {...p}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">{suffix}</span>}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; format?: (n: number) => string }) {
  const id = useId();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
        <span className="num rounded-md bg-surface-3 px-2 py-0.5 text-xs font-semibold">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ Segmented / Tabs */

export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className={cn("inline-flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-lg font-medium transition-all",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            value === o.value ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([aria-label='Close'])")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-scale-in flex-col rounded-t-3xl border border-border bg-surface shadow-pop sm:rounded-2xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-4xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmButton({ onConfirm, title, body, children, variant = "ghost", size = "sm", confirmLabel = "Delete", className, ...rest }: { onConfirm: () => void; title: string; body?: string; children: ReactNode; variant?: Variant; size?: Size; confirmLabel?: string; className?: string; "aria-label"?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)} {...rest}>{children}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => { onConfirm(); setOpen(false); }}>{confirmLabel}</Button></>}>
        <p className="text-sm text-muted">{body ?? "This action cannot be undone."}</p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Misc */

export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-border bg-surface-3 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-fg shadow-pop hidden animate-fade-in group-hover/tt:block group-focus-within/tt:block">
        {content}
      </span>
    </span>
  );
}

export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <button type="button" aria-label="More information" className="text-subtle hover:text-fg"><Info className="h-3.5 w-3.5" /></button>
    </Tooltip>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface-2 text-accent">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, info, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; info?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1 text-xs text-muted">
        {label}
        {info && <InfoTip content={info} />}
      </div>
      <div className="num mt-1 truncate text-xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, badge }: { title: string; description?: ReactNode; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone: t = "info", title, children, className, action }: { tone?: "info" | "amber" | "loss" | "accent"; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center",
        t === "info" && "border-info/25 bg-info/[.06]",
        t === "amber" && "border-amber/25 bg-amber/[.06]",
        t === "loss" && "border-loss/25 bg-loss/[.06]",
        t === "accent" && "border-accent/25 bg-accent/[.06]",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title && <p className={cn("text-[13px] font-semibold", t === "amber" && "text-amber", t === "loss" && "text-loss", t === "info" && "text-info", t === "accent" && "text-accent")}>{title}</p>}
        {children && <div className="mt-0.5 leading-relaxed text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, className, tone: t = "accent" }: { value: number; className?: string; tone?: "accent" | "amber" | "loss" | "gain" }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-all", t === "accent" && "bg-accent", t === "amber" && "bg-amber", t === "loss" && "bg-loss", t === "gain" && "bg-gain")} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
