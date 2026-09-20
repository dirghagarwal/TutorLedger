"use server";

import { revalidatePath } from "next/cache";

import { logAiAuditTrail } from "@/lib/services/ai-safety";

import {
  archiveStudent as archiveStudentRecord,
  createStudent,
  findStudentById,
  deleteStudent as deleteStudentRecord,
  updateStudent,
  type StudentInput,
} from "@/lib/repositories/students";
import { studentSchema } from "@/lib/validations/student";
import type { Student } from "@/types/students";

type ActionResult = { ok: true; student: Student } | { ok: false; error: string };

function parseInput(input: unknown): StudentInput {
  return studentSchema.parse(input);
}

function failure(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Unable to save student." };
}

function getCurrentBillingMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Server actions can also be invoked from non-request test/CLI contexts.
  }
}

export async function addStudent(input: unknown): Promise<ActionResult> {
  try {
    const student = await createStudent({
      id: crypto.randomUUID(),
      ...parseInput(input),
      billingStartMonth: getCurrentBillingMonth(),
    });
    safeRevalidate("/students");
    safeRevalidate("/calendar");
    safeRevalidate("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function editStudent(id: string, input: unknown): Promise<ActionResult> {
  try {
    const student = await updateStudent(id, parseInput(input));
    safeRevalidate("/students");
    safeRevalidate(`/students/${id}`);
    safeRevalidate("/calendar");
    safeRevalidate("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveStudent(id: string): Promise<ActionResult> {
  try {
    const student = await archiveStudentRecord(id);
    safeRevalidate("/students");
    safeRevalidate(`/students/${id}`);
    safeRevalidate("/calendar");
    safeRevalidate("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteStudent(
  id: string,
  confirmationText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const student = await findStudentById(id);
    if (!student) return { ok: false, error: "Student record not found." };

    const expected = `DELETE ${student.name.toUpperCase()}`;
    if (confirmationText.trim().toUpperCase() !== expected) {
      return { ok: false, error: "Strong deletion confirmation did not match the student name." };
    }

    await deleteStudentRecord(id);

    try {
      await logAiAuditTrail({
        action: "DELETE_STUDENT",
        entityType: "Student",
        entityId: id,
        userPrompt: confirmationText,
        result: "SUCCESS: Student permanently deleted after server-side confirmation.",
      });
    } catch {
      // Never turn a committed deletion into a retryable client failure because auditing failed.
    }

    safeRevalidate("/students");
    safeRevalidate("/calendar");
    safeRevalidate("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to delete student." };
  }
}
