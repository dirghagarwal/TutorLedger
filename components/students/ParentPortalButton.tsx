"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { createParentPortal, revokeParentPortals } from "@/app/actions/parent-portal";
import { Button } from "@/components/ui/button";

export default function ParentPortalButton({ studentId }: { studentId: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFees, setShowFees] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const result = await createParentPortal(studentId, showFees);
      setUrl(result.url);
      await navigator.clipboard?.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await revokeParentPortals(studentId);
      setUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Parent portal</p>
          <p className="text-xs text-muted-foreground">Share a read-only view for this student.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showFees}
              onChange={(e) => setShowFees(e.target.checked)}
              className="size-4 rounded border-white/10 bg-black/20"
            />
            Show fee details
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={share} disabled={busy}>
              <Link2 className="size-4" />
              {busy ? "Creating…" : "Create link"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={revoke} disabled={busy}>
              Revoke
            </Button>
          </div>
        </div>
      </div>
      {url && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-2">
          <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</code>
          <button
            type="button"
            aria-label="Copy parent portal link"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/5"
            onClick={() => {
              navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
