"use client";

import { useState, useTransition } from "react";
import { createParentPortal, revokeParentPortal } from "@/app/actions/parent-portal";

type Student = { id: string; name: string };
type Portal = { id: string; studentName: string; showFees: boolean; expiresAt: string; revokedAt: string | null };

export default function PortalManager({ students, portals }: { students: Student[]; portals: Portal[] }) {
  const [selected, setSelected] = useState(students[0]?.id ?? "");
  const [showFees, setShowFees] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await createParentPortal(selected, showFees);
      setCreatedUrl(result.url);
    });
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium">Student
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3">
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showFees} onChange={(e) => setShowFees(e.target.checked)} />
          Show fees and balance
        </label>
        <button type="button" disabled={!selected || pending} onClick={create} className="h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Creating…" : "Create private portal link"}
        </button>
      </div>

      {createdUrl && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary">Share this link with the parent</p>
          <div className="mt-2 break-all rounded-xl bg-background px-3 py-2 font-mono text-xs">{createdUrl}</div>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(createdUrl)} className="mt-3 h-10 rounded-lg border border-border px-3 text-xs hover:bg-muted">Copy link</button>
        </div>
      )}

      <div className="space-y-2">
        {portals.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{p.studentName}</p><p className="text-xs text-muted-foreground">{p.revokedAt ? "Revoked" : `Expires ${new Date(p.expiresAt).toLocaleDateString("en-IN")}`} · {p.showFees ? "Fees visible" : "Fees hidden"}</p></div>
            {!p.revokedAt && <button type="button" onClick={() => startTransition(async () => { await revokeParentPortal(p.id); window.location.reload(); })} disabled={pending} className="shrink-0 text-xs text-destructive hover:underline">Revoke</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
