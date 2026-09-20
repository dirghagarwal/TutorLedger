"use client";

import { Plus, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

import { archiveStudent, deleteStudent } from "@/app/actions/students";
import StudentCard from "@/components/students/StudentCard";
import StudentFormDialog from "@/components/students/StudentFormDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [typedDelete, setTypedDelete] = useState("");
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
    setError(null);
    setTypedDelete("");
    setDeleteTarget(student);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const student = deleteTarget;
    const removed = items.find((item) => item.student.id === student.id);
    setItems((current) => current.filter((item) => item.student.id !== student.id));
    setPendingFees((current) => current - (removed?.outstandingBalance ?? 0));
    startTransition(async () => {
      const result = await deleteStudent(student.id, typedDelete);
      if (!result.ok && removed) {
        setItems((current) => [...current, removed]);
        setPendingFees((current) => current + removed.outstandingBalance);
        setError(result.error);
      } else if (result.ok) {
        setDeleteTarget(null);
        setTypedDelete("");
      }
    });
  };

  const deleteConfirmation = deleteTarget
    ? `DELETE ${deleteTarget.name.toUpperCase()}`
    : "";

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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteTarget(null);
            setTypedDelete("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-destructive/40 bg-surface">
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete student?</DialogTitle>
            <DialogDescription>
              This removes the student and associated schedules, sessions, notes, attachments, and payment records.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                Type <span className="font-mono font-semibold">{deleteConfirmation}</span> to continue.
              </div>
              <input
                autoFocus
                aria-label={`Type ${deleteConfirmation} to confirm deletion`}
                className="w-full min-h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-destructive focus:ring-3 focus:ring-destructive/20"
                value={typedDelete}
                onChange={(event) => setTypedDelete(event.target.value)}
                placeholder={deleteConfirmation}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending || typedDelete.trim().toUpperCase() !== deleteConfirmation}
                  onClick={confirmDelete}
                >
                  {isPending ? "Deleting…" : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
