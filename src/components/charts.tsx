"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { ReactNode } from "react";
import { fmtDate, pkrCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export const SERIES = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];
const AXIS = { fontSize: 11, fill: "rgb(var(--subtle))" };

export function ChartTooltip({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  return (
    <div className="min-w-[160px] rounded-xl border border-border bg-surface-2/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      {title && <p className="mb-1.5 font-medium text-muted">{title}</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num font-semibold text-fg">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted", className)}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn("h-0.5 w-4 rounded-full", i.dashed && "border-t-2 border-dashed bg-transparent")} style={i.dashed ? { borderColor: i.color } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Time series with optional comparison lines; one shared y-axis only. */
const axisCompact = (n: number) => pkrCompact(n).replace("Rs ", "");

export function TimeSeriesChart<T extends { date: string }>({
  data, series, height = 260, yFormat = pkrCompact, area = true, refY,
}: {
  data: T[];
  series: { key: keyof T & string; label: string; color: string; dashed?: boolean; format?: (n: number) => string }[];
  height?: number;
  yFormat?: (n: number) => string;
  area?: boolean;
  refY?: number;
}) {
  const main = series[0];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${main.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={main.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={main.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d) => fmtDate(d, { day: "2-digit", month: "short" })} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (yFormat === pkrCompact ? axisCompact(v) : yFormat(v))} domain={["auto", "auto"]} />
          {refY !== undefined && <ReferenceLine y={refY} stroke="rgb(var(--subtle))" strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ stroke: "rgb(var(--subtle))", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={fmtDate(String(label))}
                  rows={series.map((s) => {
                    const p = payload.find((x) => x.dataKey === s.key);
                    const v = p?.value as number | undefined;
                    return { label: s.label, color: s.color, value: v === undefined || v === null ? "—" : (s.format ?? yFormat)(v) };
                  })}
                />
              ) : null
            }
          />
          {series.map((s, i) =>
            i === 0 && area ? (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))" }} isAnimationActive={false} />
            ) : (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.5} strokeDasharray={s.dashed ? "5 4" : undefined} fill="transparent" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            ),
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleLineChart<T extends Record<string, unknown>>({ data, xKey, lines, height = 220, yFormat, xFormat, refY, domain }: { data: T[]; xKey: string; lines: { key: string; label: string; color: string; dashed?: boolean }[]; height?: number; yFormat?: (n: number) => string; xFormat?: (v: string) => string; refY?: number[]; domain?: [number | string, number | string] }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} minTickGap={36} tickFormatter={xFormat} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={yFormat} domain={domain ?? ["auto", "auto"]} />
          {refY?.map((y) => <ReferenceLine key={y} y={y} stroke="rgb(var(--subtle))" strokeDasharray="4 4" />)}
          <Tooltip
            cursor={{ stroke: "rgb(var(--subtle))", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltip
                  title={xFormat ? xFormat(String(label)) : String(label)}
                  rows={lines.map((l) => {
                    const v = payload.find((p) => p.dataKey === l.key)?.value as number | null | undefined;
                    return { label: l.label, color: l.color, value: v === null || v === undefined ? "—" : yFormat ? yFormat(v) : v.toFixed(2) };
                  })}
                />
              ) : null
            }
          />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={l.dashed ? 1.5 : 2} strokeDasharray={l.dashed ? "5 4" : undefined} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 3.5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Signed bars (gains/losses). Colour follows sign; values always shown in tooltip text. */
export function SignedBarChart<T extends Record<string, unknown>>({ data, xKey, yKey, height = 220, yFormat = pkrCompact, xFormat, label = "Value" }: { data: T[]; xKey: string; yKey: string; height?: number; yFormat?: (n: number) => string; xFormat?: (v: string) => string; label?: string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xFormat} minTickGap={8} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (yFormat === pkrCompact ? axisCompact(v) : yFormat(v))} />
          <ReferenceLine y={0} stroke="rgb(var(--subtle))" />
          <Tooltip
            cursor={{ fill: "rgb(var(--surface-3))", fillOpacity: 0.5 }}
            content={({ active, payload, label: l }) =>
              active && payload?.length ? <ChartTooltip title={xFormat ? xFormat(String(l)) : String(l)} rows={[{ label, value: yFormat(payload[0].value as number) }]} /> : null
            }
          />
          <Bar dataKey={yKey} radius={[4, 4, 4, 4]} maxBarSize={36} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={(d[yKey] as number) >= 0 ? "rgb(var(--gain))" : "rgb(var(--loss))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlainBarChart<T extends Record<string, unknown>>({ data, xKey, bars, height = 220, yFormat, stacked }: { data: T[]; xKey: string; bars: { key: string; label: string; color: string }[]; height?: number; yFormat?: (n: number) => string; stacked?: boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
          <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} minTickGap={6} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={yFormat} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgb(var(--surface-3))", fillOpacity: 0.5 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? <ChartTooltip title={String(label)} rows={bars.map((b) => ({ label: b.label, color: b.color, value: String(payload.find((p) => p.dataKey === b.key)?.value ?? 0) }))} /> : null
            }
          />
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} stackId={stacked ? "s" : undefined} fill={b.color} radius={stacked ? (i === bars.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 4, 4]} maxBarSize={32} stroke="rgb(var(--surface))" strokeWidth={stacked ? 1 : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 200, center, format = pkrCompact }: { data: { name: string; value: number; color: string }[]; height?: number; center?: ReactNode; format?: (n: number) => string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={data.length > 1 ? 1.5 : 0} stroke="rgb(var(--surface))" strokeWidth={2} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => (active && payload?.length ? <ChartTooltip rows={[{ label: String(payload[0].name), color: (payload[0].payload as { color: string }).color, value: `${format(payload[0].value as number)} · ${((100 * (payload[0].value as number)) / total).toFixed(1)}%` }]} /> : null)} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function ScatterPlot({ data, height = 240, xLabel, yLabel, xFormat, yFormat, xDomain }: { data: { x: number; y: number; label: string }[]; height?: number; xLabel: string; yLabel: string; xFormat?: (n: number) => string; yFormat?: (n: number) => string; xDomain?: [number, number] }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.6} />
          <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS} tickLine={false} axisLine={false} domain={xDomain ?? ["auto", "auto"]} tickFormatter={xFormat} allowDecimals={false} />
          <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS} tickLine={false} axisLine={false} width={60} tickFormatter={yFormat} />
          <ZAxis range={[70, 70]} />
          <ReferenceLine y={0} stroke="rgb(var(--subtle))" />
          <Tooltip content={({ active, payload }) => (active && payload?.length ? <ChartTooltip title={(payload[0].payload as { label: string }).label} rows={[{ label: xLabel, value: xFormat ? xFormat(payload[0].payload.x) : payload[0].payload.x }, { label: yLabel, value: yFormat ? yFormat(payload[0].payload.y) : payload[0].payload.y }]} /> : null)} />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.y >= 0 ? "rgb(var(--gain))" : "rgb(var(--loss))"} stroke="rgb(var(--surface))" strokeWidth={2} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 80;
  const h = 24;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 2) - 1}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-6 w-20", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "rgb(var(--gain))" : "rgb(var(--loss))"} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
