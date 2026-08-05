"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import type { Student } from "@/types/students";

export default function StudentProfileActions({ student }: Readonly<{ student: Student }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil /> Edit student</Button>
      <StudentFormDialog
        onOpenChange={setOpen}
        onSaved={() => router.refresh()}
        open={open}
        student={student}
      />
    </>
  );
}
