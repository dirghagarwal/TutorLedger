"use client";

import { Calendar, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import AddPastClassModal from "@/components/students/AddPastClassModal";
import ScheduleDialog from "@/components/students/ScheduleDialog";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/types/schedule";
import type { Student } from "@/types/students";

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
      <AddPastClassModal student={student} />
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
