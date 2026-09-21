"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Clock, XCircle, Paperclip, Upload, Loader2 } from "lucide-react";
import {
  studentCancelSessionAction,
  studentRescheduleSessionAction,
  studentUpdateSessionNotesAction,
  studentUploadAttachmentAction,
} from "@/app/actions/parent-portal";

interface StudentSessionControlsProps {
  sessionId: string;
  initialTopic?: string;
  initialClasswork?: string;
  startTime: string;
  endTime: string;
  status: string;
  attachments?: Array<{ id: string; filename: string; storagePath: string }>;
}

export default function StudentSessionControls({
  sessionId,
  initialTopic = "",
  initialClasswork = "",
  startTime: initialStartTime,
  endTime: initialEndTime,
  status,
  attachments = [],
}: StudentSessionControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Mode toggles
  const [activeTab, setActiveTab] = useState<"none" | "editNotes" | "reschedule" | "upload" | "cancel">("none");

  // Form states
  const [topic, setTopic] = useState(initialTopic);
  const [classwork, setClasswork] = useState(initialClasswork);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isCancelled = status === "CANCELLED";

  const handleUpdateNotes = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await studentUpdateSessionNotesAction({
        sessionId,
        topic,
        classwork,
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Notes updated successfully." });
        setActiveTab("none");
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  };

  const handleReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (endTime <= startTime) {
      setMessage({ type: "error", text: "End time must be after start time." });
      return;
    }

    startTransition(async () => {
      const res = await studentRescheduleSessionAction({
        sessionId,
        startTime,
        endTime,
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Session rescheduled." });
        setActiveTab("none");
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  };

  const handleCancelSession = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await studentCancelSessionAction(sessionId);
      if (res.ok) {
        setMessage({ type: "success", text: "Session cancelled." });
        setActiveTab("none");
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  };

  const handleUploadAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);

    const formData = new FormData();
    formData.append("sessionId", sessionId);
    formData.append("file", file);

    startTransition(async () => {
      const res = await studentUploadAttachmentAction(formData);
      if (res.ok) {
        setMessage({ type: "success", text: "Attachment uploaded." });
        setActiveTab("none");
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  };

  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      {/* Existing attachments list */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <a
              key={att.id}
              href={att.storagePath}
              download={att.filename}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/80 hover:bg-white/[0.08]"
            >
              <Paperclip className="size-3.5 text-white/50" />
              <span className="max-w-[150px] truncate">{att.filename}</span>
            </a>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {!isCancelled && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "editNotes" ? "none" : "editNotes")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.07] hover:text-white"
          >
            <Edit2 className="size-3.5" />
            Edit notes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "reschedule" ? "none" : "reschedule")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.07] hover:text-white"
          >
            <Clock className="size-3.5" />
            Reschedule
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.07] hover:text-white">
            <Upload className="size-3.5" />
            {pending ? "Uploading..." : "Attach work"}
            <input
              type="file"
              onChange={handleUploadAttachment}
              disabled={pending}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "cancel" ? "none" : "cancel")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
          >
            <XCircle className="size-3.5" />
            Cancel class
          </button>
        </div>
      )}

      {message && (
        <p className={`mt-2 text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      {/* Edit Notes Sub-Form */}
      {activeTab === "editNotes" && (
        <form onSubmit={handleUpdateNotes} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Calculus: Chain Rule"
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40">Classwork</label>
            <textarea
              value={classwork}
              onChange={(e) => setClasswork(e.target.value)}
              placeholder="Summary of topics covered..."
              rows={2}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab("none")}
              className="rounded-lg px-2.5 py-1 text-xs text-white/50 hover:text-white"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      )}

      {/* Reschedule Sub-Form */}
      {activeTab === "reschedule" && (
        <form onSubmit={handleReschedule} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/40">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-white/40">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab("none")}
              className="rounded-lg px-2.5 py-1 text-xs text-white/50 hover:text-white"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              Update Time
            </button>
          </div>
        </form>
      )}

      {/* Cancel Confirmation */}
      {activeTab === "cancel" && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-950/20 p-3">
          <p className="text-xs font-medium text-red-300">Are you sure you want to cancel this class?</p>
          <p className="mt-1 text-[11px] text-white/50">
            This will mark the class and attendance as cancelled and log this action for your tutor.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("none")}
              className="rounded-lg px-2.5 py-1 text-xs text-white/50 hover:text-white"
            >
              Keep Class
            </button>
            <button
              type="button"
              onClick={handleCancelSession}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              Confirm Cancellation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
