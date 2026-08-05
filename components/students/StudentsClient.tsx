"use client";

import { Plus, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

import { archiveStudent, deleteStudent } from "@/app/actions/students";
import StudentCard from "@/components/students/StudentCard";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import { Button } from "@/components/ui/button";
import type { Student } from "@/types/students";

export interface StudentListItem {
  student: Student;
  attendedClasses: number;
  outstandingBalance: number;
  weeklySchedule: string;
}

interface StudentsClientProps {
  initialItems: StudentListItem[];
  initialPendingFees: number;
}

export default function StudentsClient({ initialItems, initialPendingFees }: Readonly<StudentsClientProps>) {
  const [items, setItems] = useState(initialItems);
  const [pendingFees, setPendingFees] = useState(initialPendingFees);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeStudents = items.filter(({ student }) => student.active).length;

  const openAdd = () => {
    setEditingStudent(null);
    setDialogOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setDialogOpen(true);
  };

  const saveStudent = (student: Student) => {
    setItems((current) => {
      const existing = current.find((item) => item.student.id === student.id);
      if (!existing) {
        return [...current, { student, attendedClasses: 0, outstandingBalance: 0, weeklySchedule: "No active schedule" }];
      }
      return current.map((item) => item.student.id === student.id ? { ...item, student } : item);
    });
    setPendingFees((current) => {
      const previous = items.find((item) => item.student.id === student.id)?.outstandingBalance ?? 0;
      return current + (student.id === editingStudent?.id ? 0 : previous);
    });
  };

  const handleArchive = (student: Student) => {
    setError(null);
    setItems((current) => current.map((item) => item.student.id === student.id ? { ...item, student: { ...item.student, active: false } } : item));
    startTransition(async () => {
      const result = await archiveStudent(student.id);
      if (!result.ok) {
        setItems((current) => current.map((item) => item.student.id === student.id ? { ...item, student } : item));
        setError(result.error);
      }
    });
  };

  const handleDelete = (student: Student) => {
    if (!window.confirm(`Delete ${student.name}? This cannot be undone.`)) return;
    setError(null);
    const removed = items.find((item) => item.student.id === student.id);
    setItems((current) => current.filter((item) => item.student.id !== student.id));
    setPendingFees((current) => current - (removed?.outstandingBalance ?? 0));
    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (!result.ok && removed) {
        setItems((current) => [...current, removed]);
        setPendingFees((current) => current + removed.outstandingBalance);
        setError(result.error);
      }
    });
  };

  const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.24em] text-primary uppercase">Students</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Track every learner, fee, and schedule in one place.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{items.length} enrolled students, {activeStudents} active profiles, and live fee tracking for each tuition slot.</p>
        </div>
        <Button className="shrink-0" onClick={openAdd}><Plus /> Add student</Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border-strong bg-surface p-5 shadow-card"><p className="text-sm text-muted-foreground">Active students</p><p className="mt-2 text-3xl font-semibold text-foreground">{activeStudents}</p></div>
        <div className="rounded-3xl border border-border-strong bg-surface p-5 shadow-card"><p className="text-sm text-muted-foreground">Pending fees</p><p className="mt-2 text-3xl font-semibold text-foreground">{currencyFormatter.format(pendingFees)}</p></div>
      </div>

      {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button size="sm" variant="ghost" onClick={() => setError(null)}><RotateCcw /> Dismiss</Button></div>}
      {items.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <StudentCard {...item} key={item.student.id} onArchive={handleArchive} onDelete={handleDelete} onEdit={openEdit} />)}</div> : <div className="rounded-3xl border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">No students have been added yet.</div>}
      {isPending && <p className="mt-4 text-xs text-muted-foreground">Saving changes…</p>}
      <StudentFormDialog onOpenChange={setDialogOpen} onSaved={saveStudent} open={dialogOpen} student={editingStudent} />
    </>
  );
}
