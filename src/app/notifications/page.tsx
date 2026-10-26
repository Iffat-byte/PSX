"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented } from "@/components/ui";
import { useApp } from "@/store/app-store";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const items = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markRead);
  const clear = useApp((s) => s.clearNotifications);
  const [f, setF] = useState<"all" | "unread" | "alert" | "reminder">("all");
  const list = items.filter((n) => (f === "all" ? true : f === "unread" ? !n.read : n.kind === f || (f === "reminder" && n.kind === "dividend")));
  return (
    <>
      <PageHeader title="Notification center" description="In-app notifications from alerts, reminders and the system." actions={<><Button size="sm" variant="outline" onClick={() => markRead()}><CheckCheck className="h-4 w-4" />Mark all read</Button><Button size="sm" variant="ghost" onClick={clear}><Trash2 className="h-4 w-4" />Clear</Button></>} />
      <Segmented className="mb-4" value={f} onChange={setF} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "alert", label: "Alerts" }, { value: "reminder", label: "Reminders" }]} />
      <Card>
        {list.length === 0 ? <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications" /> : (
          <ul className="divide-y divide-border">
            {list.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-5 py-4", !n.read && "bg-accent/[.03]")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-surface-3" : n.kind === "alert" ? "bg-amber" : "bg-accent")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{n.title}</p><Badge>{n.kind}</Badge></div>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-[11px] text-subtle">{fmtDateTime(n.createdAt)}</p>
                </div>
                {n.href && <Link href={n.href} onClick={() => markRead(n.id)} className="shrink-0 text-xs font-medium text-accent hover:underline">Open</Link>}
                {!n.read && <button onClick={() => markRead(n.id)} className="shrink-0 text-xs text-subtle hover:text-fg">Mark read</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
