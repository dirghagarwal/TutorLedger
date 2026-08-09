"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";

import { addPastClassAction } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { AttendanceStatus } from "@/types/attendance";
import type { Student } from "@/types/students";

export default function AddPastClassModal({ student }: { student: Student }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState("2026-08-05");
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("11:30");
  const [status, setStatus] = useState<AttendanceStatus>(AttendanceStatus.PRESENT);
  const [topic, setTopic] = useState("");
  const [classwork, setClasswork] = useState("");
  const [homework, setHomework] = useState("");
  const [remarks, setRemarks] = useState("");
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      toast({ title: "Please select a date", variant: "error" });
      return;
    }

    startTransition(async () => {
      const res = await addPastClassAction({
        studentId: student.id,
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

      if (!res.ok) {
        toast({ title: "Failed to add past class", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Past class recorded", description: `Recorded class for ${student.name} on ${date}.`, variant: "success" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10">
            <CalendarPlus className="size-4" /> Add Past Class
          </Button>
        }
      />
      <DialogContent className="max-w-lg rounded-2xl bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CalendarPlus className="size-5 text-primary" /> Add Past Tuition Record
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Log a historical class session for <strong className="text-foreground">{student.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Attendance Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value={AttendanceStatus.PRESENT}>PRESENT</option>
              <option value={AttendanceStatus.ABSENT}>ABSENT</option>
              <option value={AttendanceStatus.CANCELLED}>CANCELLED</option>
              <option value={AttendanceStatus.RESCHEDULED}>RESCHEDULED</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Topic Covered</label>
            <input
              type="text"
              placeholder="e.g. Algebra - Linear Equations"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Classwork</label>
              <textarea
                rows={2}
                placeholder="Ex 4.1 solved in class"
                value={classwork}
                onChange={(e) => setClasswork(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Homework</label>
              <textarea
                rows={2}
                placeholder="Ex 4.2 Q1-5"
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Remarks / Observations</label>
            <input
              type="text"
              placeholder="Good progress"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Collected (₹ Optional)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Past Class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
