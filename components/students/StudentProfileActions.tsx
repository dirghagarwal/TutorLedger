"use client";

import { Calendar, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import ScheduleDialog from "@/components/students/ScheduleDialog";
import type { Student } from "@/types/students";
import type { Schedule } from "@/types/schedule";

export default function StudentProfileActions({
  student,
  schedules = [],
}: Readonly<{
  student: Student;
  schedules?: Schedule[];
}>) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
        <Calendar className="size-4" /> Schedule
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>

      <StudentFormDialog
        onOpenChange={setEditOpen}
        onSaved={() => router.refresh()}
        open={editOpen}
        student={student}
      />

      <ScheduleDialog
        onOpenChange={setScheduleOpen}
        open={scheduleOpen}
        schedules={schedules}
        student={student}
      />
    </div>
  );
}
