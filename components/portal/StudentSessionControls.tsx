"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Clock, XCircle, Paperclip, Upload, Loader2 } from "lucide-react";
import { studentCancelSessionAction, studentRescheduleSessionAction, studentUploadAttachmentAction } from "@/app/actions/parent-portal";
import { studentUpdateClassRecord } from "@/app/actions/student-record";

interface Props { sessionId: string; initialTopic?: string; initialClasswork?: string; initialHomework?: string; startTime: string; endTime: string; status: string; attachments?: Array<{ id: string; filename: string; storagePath: string }>; }

export default function StudentSessionControls({ sessionId, initialTopic = "", initialClasswork = "", initialHomework = "", startTime: initialStartTime, endTime: initialEndTime, status, attachments = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"none" | "edit" | "time" | "cancel">("none");
  const [topic, setTopic] = useState(initialTopic);
  const [classwork, setClasswork] = useState(initialClasswork);
  const [homework, setHomework] = useState(initialHomework);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [message, setMessage] = useState<string | null>(null);
  const cancelled = status === "CANCELLED";

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => startTransition(async () => { const res = await work(); setMessage(res.ok ? success : res.error ?? "Action failed."); if (res.ok) { setTab("none"); router.refresh(); } });

  return <div className="mt-4 border-t border-white/5 pt-3">
    {attachments.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{attachments.map((att) => <a key={att.id} href={att.storagePath} download={att.filename} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/80"><Paperclip className="size-3.5 text-white/50" /><span className="max-w-[150px] truncate">{att.filename}</span></a>)}</div>}
    {!cancelled && <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setTab(tab === "edit" ? "none" : "edit")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/70 hover:bg-white/[0.07]"><Edit2 className="size-3.5" />Edit class record</button>
      <button type="button" onClick={() => setTab(tab === "time" ? "none" : "time")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/70 hover:bg-white/[0.07]"><Clock className="size-3.5" />Edit timing</button>
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/70 hover:bg-white/[0.07]"><Upload className="size-3.5" />{pending ? "Uploading…" : "Attach image/PDF"}<input type="file" className="hidden" disabled={pending} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("sessionId", sessionId); fd.append("file", file); run(() => studentUploadAttachmentAction(fd), "Attachment uploaded."); }} /></label>
      <button type="button" onClick={() => setTab(tab === "cancel" ? "none" : "cancel")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs text-red-400"><XCircle className="size-3.5" />Cancel class</button>
    </div>}
    {message && <p className="mt-2 text-xs text-white/60">{message}</p>}
    {tab === "edit" && <form className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3" onSubmit={(e) => { e.preventDefault(); run(() => studentUpdateClassRecord({ sessionId, topic, classwork, homework }), "Class record updated."); }}><label className="grid gap-1 text-[11px] text-white/45">Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white" /></label><label className="grid gap-1 text-[11px] text-white/45">What was covered / classwork<textarea value={classwork} onChange={(e) => setClasswork(e.target.value)} rows={3} className="rounded-lg border border-white/10 bg-black/40 p-2.5 text-sm text-white" /></label><label className="grid gap-1 text-[11px] text-white/45">Homework / notes given<textarea value={homework} onChange={(e) => setHomework(e.target.value)} rows={3} className="rounded-lg border border-white/10 bg-black/40 p-2.5 text-sm text-white" /></label><button disabled={pending} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">{pending && <Loader2 className="size-3 animate-spin" />}Save record</button></form>}
    {tab === "time" && <form className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(() => studentRescheduleSessionAction({ sessionId, startTime, endTime }), "Class timing updated."); }}><label className="grid gap-1 text-[11px] text-white/45">Start<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white" /></label><label className="grid gap-1 text-[11px] text-white/45">End<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white" /></label><button disabled={pending} className="self-end min-h-10 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">Update timing</button></form>}
    {tab === "cancel" && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-950/20 p-3"><p className="text-xs text-red-300">Cancel this class? This updates the class and attendance record.</p><button type="button" disabled={pending} onClick={() => run(() => studentCancelSessionAction(sessionId), "Class cancelled.")} className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-medium text-white">{pending && <Loader2 className="size-3 animate-spin" />}Confirm cancellation</button></div>}
  </div>;
}
