"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addScheduleAction, editScheduleAction, removeScheduleAction } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { DayOfWeek, type Schedule } from "@/types/schedule";
import type { Student } from "@/types/students";
import { Pencil, Plus, Trash2, X } from "lucide-react";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  schedules: Schedule[];
}

const dayOfWeekLabels: Record<DayOfWeek, string> = {
  [DayOfWeek.SUNDAY]: "Sunday",
  [DayOfWeek.MONDAY]: "Monday",
  [DayOfWeek.TUESDAY]: "Tuesday",
  [DayOfWeek.WEDNESDAY]: "Wednesday",
  [DayOfWeek.THURSDAY]: "Thursday",
  [DayOfWeek.FRIDAY]: "Friday",
  [DayOfWeek.SATURDAY]: "Saturday",
};

export default function ScheduleDialog({
  open,
  onOpenChange,
  student,
  schedules,
}: Readonly<ScheduleDialogProps>) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(DayOfWeek.MONDAY);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [subject, setSubject] = useState(student.subject || "Tuition");

  function startEdit(sch: Schedule) {
    setEditingSchedule(sch);
    setDayOfWeek(sch.dayOfWeek);
    setStartTime(sch.startTime);
    setEndTime(sch.endTime);
    setSubject(sch.subject);
  }

  function cancelEdit() {
    setEditingSchedule(null);
    setDayOfWeek(DayOfWeek.MONDAY);
    setStartTime("17:00");
    setEndTime("18:00");
    setSubject(student.subject || "Tuition");
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingSchedule) {
        const result = await editScheduleAction(editingSchedule.id, {
          studentId: student.id,
          dayOfWeek,
          startTime,
          endTime,
          subject,
        });

        if (!result.ok) {
          toast({ title: "Failed to update schedule", description: result.error, variant: "error" });
          return;
        }

        toast({ title: "Schedule slot updated", variant: "success" });
        cancelEdit();
        router.refresh();
      } else {
        const result = await addScheduleAction({
          studentId: student.id,
          dayOfWeek,
          startTime,
          endTime,
          subject,
        });

        if (!result.ok) {
          toast({ title: "Failed to add schedule", description: result.error, variant: "error" });
          return;
        }

        toast({ title: "Schedule slot added", variant: "success" });
        router.refresh();
      }
    });
  }

  async function handleDeleteSchedule(scheduleId: string) {
    startTransition(async () => {
      const result = await removeScheduleAction(scheduleId, student.id);
      if (!result.ok) {
        toast({ title: "Failed to delete schedule", description: result.error, variant: "error" });
        return;
      }

      if (result.softDeactivated) {
        toast({
          title: "Schedule slot deactivated",
          description: "This slot had historical classes, so it was archived to preserve your records.",
          variant: "success",
        });
      } else {
        toast({ title: "Schedule slot removed", variant: "success" });
      }
      if (editingSchedule?.id === scheduleId) cancelEdit();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) cancelEdit(); }}>
      <DialogContent className="max-w-md border-border-strong bg-surface text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle>Manage Weekly Schedule</DialogTitle>
          <DialogDescription>
            Configure recurring class days and times for {student.name}.
          </DialogDescription>
        </DialogHeader>

        {/* Existing Schedules */}
        <div className="space-y-3 py-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Current Weekly Slots ({schedules.length})
          </h4>
          {schedules.length === 0 ? (
            <p className="rounded-xl border border-border/50 bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              No weekly class slots set yet. Add your first recurring class below.
            </p>
          ) : (
            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
              {schedules.map((sch) => (
                <div
                  key={sch.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/60 p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {dayOfWeekLabels[sch.dayOfWeek]} · {sch.subject}
                    </p>
                    <p className="text-muted-foreground">
                      {sch.startTime} – {sch.endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                      disabled={isPending}
                      onClick={() => startEdit(sch)}
                      title="Edit this recurring slot"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                      onClick={() => handleDeleteSchedule(sch.id)}
                      title="Delete or archive this recurring slot"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Schedule Form */}
        <form onSubmit={handleSaveSchedule} className="space-y-3 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {editingSchedule ? "Edit Recurring Slot" : "Add New Recurring Slot"}
            </h4>
            {editingSchedule && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={cancelEdit}
              >
                <X className="mr-1 size-3" /> Cancel edit
              </Button>
            )}
          </div>
          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Day of Week</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-xs text-foreground outline-none"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
              >
                {Object.entries(dayOfWeekLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Time</label>
                <Input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Time</label>
                <Input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
              <Input
                required
                placeholder="e.g. Mathematics, Science"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editingSchedule && (
              <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={isPending}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isPending} size="sm">
              {editingSchedule ? (
                <>
                  <Pencil className="size-3.5 mr-1" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Add Class Slot
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
