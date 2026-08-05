"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStudent, editStudent } from "@/app/actions/students";
import { studentSchema, type StudentFormValues } from "@/lib/validations/student";
import { FeeType, type Student } from "@/types/students";

const DEFAULT_VALUES: StudentFormValues = {
  name: "",
  subject: "",
  feeType: FeeType.MONTHLY,
  fee: 0,
  active: true,
  color: "#2563EB",
};

interface StudentFormDialogProps {
  open: boolean;
  student?: Student | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (student: Student) => void;
}

export default function StudentFormDialog({
  open,
  student,
  onOpenChange,
  onSaved,
}: Readonly<StudentFormDialogProps>) {
  const isEditing = Boolean(student);
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: student
      ? {
          name: student.name,
          subject: student.subject,
          feeType: student.feeType,
          fee: student.fee,
          active: student.active,
          color: student.color,
        }
      : DEFAULT_VALUES,
  });

  useEffect(() => {
    form.reset(
      student
        ? {
            name: student.name,
            subject: student.subject,
            feeType: student.feeType,
            fee: student.fee,
            active: student.active,
            color: student.color,
          }
        : DEFAULT_VALUES
    );
  }, [form, student, open]);

  const submit = form.handleSubmit(async (values) => {
    const result = isEditing && student
      ? await editStudent(student.id, values)
      : await addStudent(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    onSaved(result.student);
    onOpenChange(false);
    form.reset(DEFAULT_VALUES);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border-strong bg-surface text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this learner's profile and billing details." : "Create a profile for a new learner."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} placeholder="e.g. Tanay" />
          </Field>
          <Field label="Subject" error={form.formState.errors.subject?.message}>
            <Input {...form.register("subject")} aria-invalid={Boolean(form.formState.errors.subject)} placeholder="e.g. Computer" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fee model" error={form.formState.errors.feeType?.message}>
              <select {...form.register("feeType")} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value={FeeType.MONTHLY}>Monthly</option>
                <option value={FeeType.CLASSWISE}>Class-wise</option>
              </select>
            </Field>
            <Field label="Fee amount" error={form.formState.errors.fee?.message}>
              <Input {...form.register("fee", { valueAsNumber: true })} aria-invalid={Boolean(form.formState.errors.fee)} min={1} type="number" />
            </Field>
          </div>
          <Field label="Avatar color" error={form.formState.errors.color?.message}>
            <div className="flex items-center gap-3">
              <input {...form.register("color")} aria-label="Avatar color" className="size-9 cursor-pointer rounded-lg border border-input bg-transparent p-0.5" type="color" />
              <span className="text-sm text-muted-foreground">Used to generate the profile avatar.</span>
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm text-secondary-foreground">
            <input {...form.register("active")} className="size-4 accent-primary" type="checkbox" />
            Active student
          </label>
          {form.formState.errors.root?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}
          <DialogFooter className="-mx-4 -mb-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children, error, label }: Readonly<{ children: React.ReactNode; error?: string; label: string }>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-secondary-foreground">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-destructive">{error}</span>}
    </label>
  );
}
