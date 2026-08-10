"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { addSessionAttachment, addSessionNote, markClassTakenFromProfile } from "@/app/actions/sessions";
import SessionDetailsSheet from "@/components/sessions/SessionDetailsSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDisplayDate, getTodayDateKey } from "@/lib/utils/date";
import type { Attachment } from "@/types/attachment";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import type { Payment } from "@/types/payment";
import type { Session } from "@/types/session";
import type { SessionNote } from "@/types/session-note";
import type { Schedule } from "@/types/schedule";
import type { Student } from "@/types/students";

export interface MonthlyClassTrackerProps {
  student: Student;
  schedules: Schedule[];
  sessions: Session[];
  attendance: Attendance[];
  notesBySession: Record<string, SessionNote[]>;
  attachmentsBySession: Record<string, Attachment[]>;
  paymentsBySession: Record<string, Payment[]>;
}

export default function MonthlyClassTracker({
  student,
  schedules,
  sessions,
  attendance,
  notesBySession,
  attachmentsBySession,
  paymentsBySession,
}: MonthlyClassTrackerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const todayKey = getTodayDateKey();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7); // "YYYY-MM"
  });

  // Modal State for Homework / Notes
  const [noteModalTarget, setNoteModalTarget] = useState<{
    date: string;
    scheduleId?: string;
    sessionId?: string;
    topic?: string;
    classwork?: string;
    homework?: string;
    remarks?: string;
  } | null>(null);

  const [topic, setTopic] = useState("");
  const [classwork, setClasswork] = useState("");
  const [homework, setHomework] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Modal State for Session Details
  const [selectedDetailsSessionId, setSelectedDetailsSessionId] = useState<string | null>(null);

  // Month navigation helpers
  const [yearStr, monthStr] = selectedMonth.split("-");
  const currentYear = Number(yearStr) || 2026;
  const currentMonthIdx = (Number(monthStr) || 8) - 1; // 0-indexed

  function navigateMonth(direction: -1 | 1) {
    const newDate = new Date(currentYear, currentMonthIdx + direction, 1);
    setSelectedMonth(newDate.toISOString().slice(0, 7));
  }

  const monthDisplayLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(currentYear, currentMonthIdx, 1));

  // Generate occurrences for selected month
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const occurrences: {
    date: string;
    dayOfWeek: string;
    scheduleId?: string;
    startTime: string;
    endTime: string;
    subject: string;
    session?: Session;
    attendanceRec?: Attendance;
  }[] = [];

  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonthIdx, day);
    const dateKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayOfWeekName = dayNames[d.getDay()]!;

    const matchingSchedules = schedules.filter((s) => s.active && s.dayOfWeek === dayOfWeekName);
    const matchingSessions = sessions.filter((s) => s.date === dateKey);

    if (matchingSchedules.length > 0) {
      for (const sched of matchingSchedules) {
        const existingSession = matchingSessions.find((s) => s.scheduleId === sched.id || s.date === dateKey);
        const existingAtt = existingSession
          ? attendance.find((a) => a.sessionId === existingSession.id)
          : undefined;

        occurrences.push({
          date: dateKey,
          dayOfWeek: dayOfWeekName,
          scheduleId: sched.id,
          startTime: sched.startTime,
          endTime: sched.endTime,
          subject: student.subject,
          session: existingSession,
          attendanceRec: existingAtt,
        });
      }
    } else if (matchingSessions.length > 0) {
      for (const sess of matchingSessions) {
        const existingAtt = attendance.find((a) => a.sessionId === sess.id);
        occurrences.push({
          date: dateKey,
          dayOfWeek: dayOfWeekName,
          scheduleId: sess.scheduleId,
          startTime: sess.startTime,
          endTime: sess.endTime,
          subject: student.subject,
          session: sess,
          attendanceRec: existingAtt,
        });
      }
    }
  }

  occurrences.sort((a, b) => a.date.localeCompare(b.date));

  async function handleMarkTaken(item: (typeof occurrences)[0]) {
    startTransition(async () => {
      const res = await markClassTakenFromProfile({
        studentId: student.id,
        date: item.date,
        scheduleId: item.scheduleId,
        startTime: item.startTime,
        endTime: item.endTime,
      });

      if (!res.ok) {
        toast({ title: "Failed to mark class taken", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Class marked as taken!", description: `Recorded attendance for ${formatDisplayDate(item.date)}.`, variant: "success" });
      router.refresh();
    });
  }

  function openNoteModal(item: (typeof occurrences)[0]) {
    const existingNotes = item.session ? notesBySession[item.session.id] || [] : [];
    const latestNote = existingNotes[0];

    setTopic(latestNote?.topic || `${student.subject} Lesson`);
    setClasswork(latestNote?.classwork || "");
    setHomework(latestNote?.homework || "");
    setRemarks(latestNote?.remarks || "");
    setSelectedFile(null);

    setNoteModalTarget({
      date: item.date,
      scheduleId: item.scheduleId,
      sessionId: item.session?.id,
    });
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteModalTarget) return;

    startTransition(async () => {
      // 1. Ensure Session exists for target date
      const targetSessionId = noteModalTarget.sessionId || `session-${noteModalTarget.date}-${student.id}`;

      const noteRes = await addSessionNote({
        sessionId: targetSessionId,
        studentId: student.id,
        scheduleId: noteModalTarget.scheduleId || "adhoc",
        date: noteModalTarget.date,
        topic: topic || `${student.subject} Lesson`,
        classwork,
        homework,
        remarks,
      });

      if (!noteRes.ok) {
        toast({ title: "Failed to save homework/notes", description: noteRes.error, variant: "error" });
        return;
      }

      // 2. Upload Attachment if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("sessionId", targetSessionId);
        formData.append("studentId", student.id);
        formData.append("scheduleId", noteModalTarget.scheduleId || "adhoc");
        formData.append("date", noteModalTarget.date);
        formData.append("type", selectedFile.type.startsWith("image/") ? "IMAGE" : "FILE");
        formData.append("file", selectedFile);

        const attachRes = await addSessionAttachment(formData);
        if (!attachRes.ok) {
          toast({ title: "Notes saved, but attachment upload failed", description: attachRes.error, variant: "destructive" });
        }
      }

      toast({ title: "Homework & Notes saved!", description: `Saved for ${formatDisplayDate(noteModalTarget.date)}.`, variant: "success" });
      setNoteModalTarget(null);
      router.refresh();
    });
  }

  const activeDetailsRecord = selectedDetailsSessionId
    ? {
        session: sessions.find((s) => s.id === selectedDetailsSessionId)!,
        studentName: student.name,
        studentColor: student.color,
        attendance: attendance.find((a) => a.sessionId === selectedDetailsSessionId) ?? null,
        payments: paymentsBySession[selectedDetailsSessionId] || [],
        notes: notesBySession[selectedDetailsSessionId] || [],
        attachments: attachmentsBySession[selectedDetailsSessionId] || [],
      }
    : null;

  return (
    <Card className="mt-6 border-border-strong bg-surface text-foreground shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <CardTitle className="text-lg font-bold text-foreground">Monthly Class Tracker</CardTitle>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)} className="h-8 w-8 p-0">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs font-semibold px-2 min-w-[110px] text-center">{monthDisplayLabel}</span>
          <Button variant="outline" size="sm" onClick={() => navigateMonth(1)} className="h-8 w-8 p-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {occurrences.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No classes scheduled for {monthDisplayLabel}. Use <strong>Schedule</strong> or <strong>Add Past Class</strong> above.
          </div>
        ) : (
          <div className="space-y-3">
            {occurrences.map((item) => {
              const attStatus = item.attendanceRec?.status;
              const isTaken = attStatus === AttendanceStatus.PRESENT;
              const isAbsent = attStatus === AttendanceStatus.ABSENT;
              const isCancelled = attStatus === AttendanceStatus.CANCELLED;
              const isRescheduled = attStatus === AttendanceStatus.RESCHEDULED;

              const isToday = item.date === todayKey;
              const hasNotes = item.session && (notesBySession[item.session.id]?.length ?? 0) > 0;

              return (
                <div
                  key={`${item.date}-${item.startTime}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    isTaken
                      ? "border-success/30 bg-success/5"
                      : isAbsent
                      ? "border-destructive/30 bg-destructive/5"
                      : isCancelled
                      ? "border-muted bg-muted/30"
                      : isToday
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  {/* Left: Date, Time & Status Indicator */}
                  <div className="flex items-center gap-3">
                    {/* Indicator Badge */}
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                        isTaken
                          ? "bg-success/20 text-success"
                          : isAbsent
                          ? "bg-destructive/20 text-destructive"
                          : isCancelled
                          ? "bg-muted text-muted-foreground"
                          : isRescheduled
                          ? "bg-warning/20 text-warning"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {isTaken ? "✓" : isAbsent ? "A" : isCancelled ? "C" : isRescheduled ? "R" : "○"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {formatDisplayDate(item.date)}
                        </span>
                        {isToday && (
                          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary px-1.5 py-0">
                            Today
                          </Badge>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>
                          {item.startTime} – {item.endTime} · {item.subject}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (Mark Taken, Homework, Details) */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Status Badge Text */}
                    <span className="mr-1 text-xs font-medium">
                      {isTaken ? (
                        <span className="text-success font-semibold flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" /> Taken
                        </span>
                      ) : isAbsent ? (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <XCircle className="size-3.5" /> Absent
                        </span>
                      ) : isCancelled ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="size-3.5" /> Cancelled
                        </span>
                      ) : isRescheduled ? (
                        <span className="text-warning flex items-center gap-1">
                          <RefreshCw className="size-3.5" /> Rescheduled
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Scheduled</span>
                      )}
                    </span>

                    {/* Button 1: Mark Taken */}
                    {!isTaken && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isPending}
                        onClick={() => handleMarkTaken(item)}
                        className="h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
                      >
                        {isPending ? <Loader2 className="size-3 animate-spin" /> : "Mark Taken"}
                      </Button>
                    )}

                    {/* Button 2: Homework / Notes */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openNoteModal(item)}
                      className={`h-8 text-xs ${hasNotes ? "border-primary/40 text-primary bg-primary/10" : ""}`}
                    >
                      <BookOpen className="size-3.5 mr-1" />
                      {hasNotes ? "Notes (✓)" : "Homework"}
                    </Button>

                    {/* Button 3: Details */}
                    {item.session && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedDetailsSessionId(item.session!.id)}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3.5 mr-1" /> Details
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Homework / Session Notes Modal */}
      {noteModalTarget && (
        <Dialog open={Boolean(noteModalTarget)} onOpenChange={(open) => { if (!open) setNoteModalTarget(null); }}>
          <DialogContent className="max-w-md rounded-2xl bg-surface border-border/80">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <FileText className="size-5 text-primary" /> Session Notes & Homework
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Target Date: <strong className="text-foreground">{formatDisplayDate(noteModalTarget.date)}</strong>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveNote} className="space-y-3 py-1">
              <div>
                <label className="text-xs font-medium text-foreground">Topic Covered</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Quadratic Equations Ex 5A"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Classwork Completed</label>
                <textarea
                  rows={2}
                  value={classwork}
                  onChange={(e) => setClasswork(e.target.value)}
                  placeholder="e.g. Solved Q1 to Q5 in class"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Homework Assigned</label>
                <textarea
                  rows={2}
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="e.g. Exercise 5A Q6 to 10"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Teacher Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Needs more practice on factoring"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Attach Image / File (Optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold file:text-foreground hover:file:bg-primary/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setNoteModalTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="bg-primary text-primary-foreground">
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Notes & Homework"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Session Details Sheet */}
      {activeDetailsRecord && (
        <SessionDetailsSheet
          onOpenChange={(open) => { if (!open) setSelectedDetailsSessionId(null); }}
          open={Boolean(selectedDetailsSessionId)}
          record={activeDetailsRecord}
        />
      )}
    </Card>
  );
}
