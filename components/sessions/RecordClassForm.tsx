"use client";

import { CalendarPlus, Check, Loader2, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addPastClassAction } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AttendanceStatus } from "@/types/attendance";
import type { Schedule } from "@/types/schedule";
import type { Student } from "@/types/students";

interface RecordClassFormProps {
  students: readonly Student[];
  schedules: readonly Schedule[];
  defaultDate: string;
}

export default function RecordClassForm({
  students,
  schedules,
  defaultDate,
}: Readonly<RecordClassFormProps>) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const activeStudents = useMemo(() => students.filter((student) => student.active), [students]);
  const initialStudentId = activeStudents[0]?.id ?? "";
  const initialSchedule = schedules.find(
    (schedule) => schedule.studentId === initialStudentId && schedule.active
  );
  const [studentId, setStudentId] = useState(initialStudentId);
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(initialSchedule?.startTime ?? "16:30");
  const [endTime, setEndTime] = useState(initialSchedule?.endTime ?? "17:30");
  const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [topic, setTopic] = useState("");
  const [classwork, setClasswork] = useState("");
  const [homework, setHomework] = useState("");
  const [remarks, setRemarks] = useState("");
  const [amount, setAmount] = useState("");

  const studentSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.studentId === studentId && schedule.active),
    [schedules, studentId]
  );

  const selectedSchedule = useMemo(
    () => studentSchedules.find(
      (schedule) => schedule.startTime === startTime && schedule.endTime === endTime
    ) ?? studentSchedules[0],
    [studentSchedules, startTime, endTime]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentId) {
      toast({ title: "Select a student", variant: "error" });
      return;
    }

    if (!date || !startTime || !endTime) {
      toast({ title: "Date and class time are required", variant: "error" });
      return;
    }

    startTransition(async () => {
      const result = await addPastClassAction({
        studentId,
        scheduleId: selectedSchedule?.id,
        date,
        startTime,
        endTime,
        status,
        topic,
        classwork,
        homework,
        remarks,
        amount: amount ? Number(amount) : undefined,
      });

      if (!result.ok) {
        toast({
          title: "Could not record class",
          description: result.error,
          variant: "error",
        });
        return;
      }

      toast({
        title: "Class recorded",
        description: "The class was saved to the teaching record.",
        variant: "success",
      });
      router.push("/students/" + studentId);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <section className="rounded-2xl border border-border-strong bg-surface p-5 shadow-card">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarPlus className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Class details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record a class manually with its exact date, time, attendance, and teaching notes.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student">
            <select
              value={studentId}
              onChange={(event) => {
                const nextStudentId = event.target.value;
                const nextSchedule = schedules.find(
                  (schedule) => schedule.studentId === nextStudentId && schedule.active
                );
                setStudentId(nextStudentId);
                setStartTime(nextSchedule?.startTime ?? "16:30");
                setEndTime(nextSchedule?.endTime ?? "17:30");
              }}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              required
            >
              {activeStudents.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.name} · {student.subject}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Attendance status">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AttendanceStatus)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value={AttendanceStatus.PRESENT}>Present</option>
              <option value={AttendanceStatus.ABSENT}>Absent</option>
              <option value={AttendanceStatus.CANCELLED}>Cancelled</option>
              <option value={AttendanceStatus.RESCHEDULED}>Rescheduled</option>
            </select>
          </Field>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              required
            />
          </Field>

          <Field label="Scheduled slot">
            <select
              value={selectedSchedule?.id ?? ""}
              onChange={(event) => {
                const schedule = studentSchedules.find((item) => item.id === event.target.value);
                if (!schedule) return;
                setStartTime(schedule.startTime);
                setEndTime(schedule.endTime);
              }}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              disabled={studentSchedules.length === 0}
            >
              {studentSchedules.length === 0 ? (
                <option value="">No active schedule — enter time below</option>
              ) : (
                studentSchedules.map((schedule) => (
                  <option value={schedule.id} key={schedule.id}>
                    {schedule.startTime} – {schedule.endTime}
                  </option>
                ))
              )}
            </select>
          </Field>

          <Field label="Start time">
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              required
            />
          </Field>

          <Field label="End time">
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
              required
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border-strong bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-foreground">Teaching record</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Topic covered">
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. Fractions — exercise 4.2"
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Classwork completed">
              <textarea
                value={classwork}
                onChange={(event) => setClasswork(event.target.value)}
                placeholder="What was completed in class?"
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label="Homework given">
              <textarea
                value={homework}
                onChange={(event) => setHomework(event.target.value)}
                placeholder="What should the student do next?"
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>
          </div>

          <Field label="Private remarks">
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional observations"
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border-strong bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-foreground">Payment (optional)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record money collected with this class. Leave blank when no payment was received.
        </p>
        <div className="mt-4 max-w-sm">
          <Field label="Amount collected (₹)">
            <input
              inputMode="decimal"
              min="0"
              step="1"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 2000"
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-36">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isPending ? "Saving…" : "Record class"}
        </Button>
      </div>

      <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5" /> Database is the source of truth; this writes a real session and attendance record.
      </p>
    </form>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
