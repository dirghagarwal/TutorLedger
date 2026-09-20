"use client";

import { Pencil, Save, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateSessionAction } from "@/app/actions/sessions";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { SessionStatus, type Session } from "@/types/session";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface EditSessionDialogProps {
  session: Session;
  attendance: Attendance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function EditSessionDialog({
  session,
  attendance,
  open,
  onOpenChange,
  onSaved,
}: Readonly<EditSessionDialogProps>) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(session.date);
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [status, setStatus] = useState<SessionStatus>(session.status);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | "">(
    attendance?.status ?? ""
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateSessionAction({
        sessionId: session.id,
        date,
        startTime,
        endTime,
        status,
        ...(attendanceStatus ? { attendanceStatus } : {}),
      });

      if (!result.ok) {
        toast({
          title: "Could not update class",
          description: result.error,
          variant: "error",
        });
        return;
      }

      toast({
        title: "Class updated",
        description: "The class date, time, and status were saved.",
        variant: "success",
      });
      onOpenChange(false);
      onSaved?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border-strong bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Pencil className="size-5 text-primary" />
            Modify class
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Change the exact class date, time, session state, or attendance record without deleting the session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <input
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>
            <Field label="Start time">
              <input
                required
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>
            <Field label="End time">
              <input
                required
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Session status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as SessionStatus)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value={SessionStatus.PLANNED}>Scheduled</option>
                <option value={SessionStatus.IN_PROGRESS}>In progress</option>
                <option value={SessionStatus.COMPLETED}>Completed</option>
                <option value={SessionStatus.CANCELLED}>Cancelled</option>
                <option value={SessionStatus.RESCHEDULED}>Rescheduled</option>
              </select>
            </Field>

            <Field label="Attendance">
              <select
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value as AttendanceStatus | "")}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Leave unchanged</option>
                <option value={AttendanceStatus.PRESENT}>Present</option>
                <option value={AttendanceStatus.ABSENT}>Absent</option>
                <option value={AttendanceStatus.CANCELLED}>Cancelled</option>
                <option value={AttendanceStatus.RESCHEDULED}>Rescheduled</option>
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              <X className="size-4" /> Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="size-4" />
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
