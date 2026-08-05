"use server";

import { revalidatePath } from "next/cache";

import {
  archiveStudent as archiveStudentRecord,
  createStudent,
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

export async function addStudent(input: unknown): Promise<ActionResult> {
  try {
    const student = await createStudent({ id: crypto.randomUUID(), ...parseInput(input) });
    revalidatePath("/students");
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function editStudent(id: string, input: unknown): Promise<ActionResult> {
  try {
    const student = await updateStudent(id, parseInput(input));
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveStudent(id: string): Promise<ActionResult> {
  try {
    const student = await archiveStudentRecord(id);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true, student };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteStudent(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteStudentRecord(id);
    revalidatePath("/students");
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to delete student." };
  }
}
