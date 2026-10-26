export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/20 to-info/10">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
          <path d="M12 44 L26 30 L35 37 L52 20" fill="none" stroke="rgb(var(--accent))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="52" cy="20" r="5" fill="rgb(var(--amber))" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">PSX Pilot</p>
          <p className="text-[10px] text-subtle">Intelligent Investing Workspace</p>
        </div>
      )}
    </div>
  );
}
