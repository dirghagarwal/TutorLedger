"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

import { addSessionNote } from "@/app/actions/sessions";
import { addStudent } from "@/app/actions/students";
import {
  recordAttendance,
  updateClassStatus,
} from "@/app/actions/workflow";
import { ensureSessionExists } from "@/lib/repositories/sessions";
import { findStudents } from "@/lib/repositories/students";
import {
  getPendingStudents,
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";
import { formatDisplayDate, getTodayDateKey, parseRelativeDate } from "@/lib/utils/date";
import { aiActionSchema } from "@/lib/validations/ai";
import { SessionStatus } from "@/types/session";
import type { Student } from "@/types/students";

export interface AiCommandResult {
  ok: boolean;
  message: string;
  actionType?: string;
  requiresConfirmation?: boolean;
  requiresClarification?: boolean;
  confirmationPayload?: {
    action: string;
    studentId?: string;
    studentName?: string;
    details?: string;
  };
  data?: Record<string, unknown>;
  llmUsed?: string;
}

export async function processAiCommand(prompt: string): Promise<AiCommandResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: "Please type a prompt or query." };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: "GEMINI_API_KEY is not configured in server environment.",
    };
  }

  const enrolledStudents = await findStudents();
  const enrolledNamesList = enrolledStudents.map((s) => s.name);
  const todayKolkataDate = getTodayDateKey();

  let rawLlmOutput: unknown;
  let modelName = "gemini-1.5-flash-latest";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            action: {
              type: SchemaType.STRING,
            },
            studentName: { type: SchemaType.STRING, nullable: true },
            name: { type: SchemaType.STRING },
            subject: { type: SchemaType.STRING },
            fee: { type: SchemaType.NUMBER },
            feeType: { type: SchemaType.STRING },
            amount: { type: SchemaType.NUMBER },
            method: { type: SchemaType.STRING },
            status: { type: SchemaType.STRING },
            topic: { type: SchemaType.STRING },
            classwork: { type: SchemaType.STRING },
            homework: { type: SchemaType.STRING },
            remarks: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            notes: { type: SchemaType.STRING },
          },
          required: ["action"],
        },
      },
    });

    const systemPrompt = `You are TutorLedger's command interpreter AI.
Today's date is ${todayKolkataDate} (Asia/Kolkata time zone).

Available enrolled students in database:
${enrolledNamesList.length > 0 ? enrolledNamesList.map((n) => `- "${n}"`).join("\n") : "No enrolled students yet"}

STRICT ENTITY EXTRACTION RULES:
1. Extract studentName ONLY if explicitly mentioned in the user's input.
2. NEVER invent a student name or use generic terms like "student", "the student", "user", "person", "someone".
3. If student name is omitted, unspecified, or ambiguous, return studentName = null.
4. For combined student names in database (e.g. "Aahan & Aalya"), match the combined name.

STRICT DATE RULES:
- If user mentions "today", "tomorrow", "yesterday", extract date as "today", "tomorrow", or "yesterday".
- DO NOT invent arbitrary dates in the past (like 2026-07-27). Default date to "today".

Action Intent Schema:
- "QUERY_STATS": Asking about pending fees, revenue, or student list. Set topic to "PENDING_FEES", "REVENUE", or "STUDENT_LIST".
- "RECORD_ATTENDANCE": Set studentName and status ("PRESENT", "ABSENT", "CANCELLED", "RESCHEDULED").
- "RECORD_PAYMENT": Set studentName, amount (number), and optional method ("CASH", "UPI", "BANK_TRANSFER").
- "START_CLASS": Set studentName.
- "END_CLASS": Set studentName.
- "ADD_SESSION_NOTE": Set studentName, and homework, classwork, topic, or remarks.
- "CREATE_STUDENT": Set name, subject, fee (number), and feeType ("MONTHLY" or "CLASSWISE").
- "DELETE_STUDENT_REQUEST": Set studentName when asked to delete/remove a student.`;

    const response = await model.generateContent([systemPrompt, `User command: "${trimmed}"`]);
    const text = response.response.text();
    rawLlmOutput = JSON.parse(text);
  } catch {
    rawLlmOutput = parsePromptFallback(trimmed, enrolledNamesList);
    modelName = "gemini-1.5-flash-latest (fallback)";
  }

  // Zod Validation of Structured Output
  const parseResult = aiActionSchema.safeParse(rawLlmOutput);

  if (!parseResult.success) {
    return {
      ok: false,
      message: `Command schema validation failed: ${parseResult.error.issues[0]?.message ?? "Invalid format."}`,
      llmUsed: modelName,
    };
  }

  const action = parseResult.data;

  // Execute Action via existing server actions & services
  switch (action.action) {
    case "RECORD_ATTENDANCE": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      const targetDate = parseRelativeDate(action.date, trimmed);
      const session = await ensureSessionExists({
        studentId: student.id,
        date: targetDate,
      });

      const result = await recordAttendance({
        sessionId: session.id,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: action.status,
        notes: "Recorded via Gemini AI",
      });

      if (!result.ok) {
        return { ok: false, message: result.error, llmUsed: modelName };
      }

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "RECORD_ATTENDANCE",
        message: `Marked ${student.name} ${action.status} for ${formatDisplayDate(session.date)}.`,
        llmUsed: modelName,
      };
    }

    case "CREATE_STUDENT": {
      const result = await addStudent({
        name: action.name,
        subject: action.subject,
        fee: action.fee,
        feeType: action.feeType,
        color: getRandomAvatarColor(),
        active: true,
      });

      if (!result.ok) {
        return { ok: false, message: result.error, llmUsed: modelName };
      }

      revalidatePath("/students");
      revalidatePath("/");
      return {
        ok: true,
        actionType: "CREATE_STUDENT",
        message: `Successfully added student ${action.name} (${action.subject}) with ₹${action.fee} ${action.feeType.toLowerCase()} fee.`,
        llmUsed: modelName,
      };
    }

    case "RECORD_PAYMENT": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      return {
        ok: true,
        requiresConfirmation: true,
        actionType: "RECORD_PAYMENT",
        message: `⚠️ Record payment of ₹${action.amount} (${action.method}) for student "${student.name}"?`,
        confirmationPayload: {
          action: "CONFIRM_RECORD_PAYMENT",
          studentId: student.id,
          studentName: student.name,
          details: `Amount: ₹${action.amount} · Method: ${action.method} · Notes: ${action.notes}`,
        },
        data: {
          studentId: student.id,
          amount: action.amount,
          method: action.method,
          notes: action.notes,
        },
        llmUsed: modelName,
      };
    }

    case "START_CLASS": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      const targetDate = getTodayDateKey();
      const session = await ensureSessionExists({
        studentId: student.id,
        date: targetDate,
      });

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.IN_PROGRESS,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      });

      if (!result.ok) return { ok: false, message: result.error, llmUsed: modelName };

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "START_CLASS",
        message: `Started class for ${student.name} on ${session.date}. Status updated to IN_PROGRESS.`,
        llmUsed: modelName,
      };
    }

    case "END_CLASS": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      const targetDate = getTodayDateKey();
      const session = await ensureSessionExists({
        studentId: student.id,
        date: targetDate,
      });

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.COMPLETED,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      });

      if (!result.ok) return { ok: false, message: result.error, llmUsed: modelName };

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "END_CLASS",
        message: `Ended class for ${student.name} on ${session.date}. Status updated to COMPLETED.`,
        llmUsed: modelName,
      };
    }

    case "ADD_SESSION_NOTE": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      const targetDate = getTodayDateKey();
      const session = await ensureSessionExists({
        studentId: student.id,
        date: targetDate,
      });

      const result = await addSessionNote({
        sessionId: session.id,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        topic: action.topic || "Tuition Session",
        classwork: action.classwork || "",
        homework: action.homework || "",
        remarks: action.remarks || "",
      });

      if (!result.ok) return { ok: false, message: result.error, llmUsed: modelName };

      revalidatePath(`/students/${student.id}`);
      revalidatePath("/calendar");
      return {
        ok: true,
        actionType: "ADD_SESSION_NOTE",
        message: `Saved session notes for ${student.name} on ${session.date}.`,
        llmUsed: modelName,
      };
    }

    case "QUERY_STATS": {
      const students = enrolledStudents;

      if (action.topic === "PENDING_FEES") {
        const totalPending = await getTotalOutstandingBalance(students);
        const pendingStudents = await getPendingStudents(students);
        const names = pendingStudents.map((s) => s.name).join(", ");
        return {
          ok: true,
          actionType: "QUERY_STATS",
          message: `Total pending fees: ₹${totalPending.toLocaleString("en-IN")}.${names ? ` Students with pending fees: ${names}.` : " No students currently have pending fees."}`,
          llmUsed: modelName,
        };
      }

      if (action.topic === "REVENUE") {
        const revenue = await getRevenueThisMonth();
        return {
          ok: true,
          actionType: "QUERY_STATS",
          message: `Total revenue collected this month: ₹${revenue.toLocaleString("en-IN")}.`,
          llmUsed: modelName,
        };
      }

      return {
        ok: true,
        actionType: "QUERY_STATS",
        message: `You currently have ${students.length} active students enrolled: ${students.map((s) => s.name).join(", ")}.`,
        llmUsed: modelName,
      };
    }

    case "DELETE_STUDENT_REQUEST": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;

      return {
        ok: true,
        requiresConfirmation: true,
        actionType: "DELETE_STUDENT_REQUEST",
        message: `⚠️ Are you sure you want to delete student "${student.name}"? This action cannot be undone.`,
        confirmationPayload: {
          action: "CONFIRM_DELETE_STUDENT",
          studentId: student.id,
          studentName: student.name,
          details: `Subject: ${student.subject} · Fee: ₹${student.fee} (${student.feeType})`,
        },
        llmUsed: modelName,
      };
    }
  }
}

type EntityResult =
  | { type: "SUCCESS"; student: Student }
  | { type: "MISSING_OR_GENERIC"; message: string }
  | { type: "MULTIPLE_MATCHES"; message: string }
  | { type: "NOT_FOUND"; message: string };

async function resolveStudentEntity(
  rawName: string | null | undefined,
  enrolledStudents: Student[]
): Promise<EntityResult> {
  const availableListMsg = enrolledStudents.length > 0
    ? `Available enrolled students: ${enrolledStudents.map((s) => `"${s.name}"`).join(", ")}.`
    : "No enrolled students found.";

  if (!rawName || isGenericName(rawName)) {
    return {
      type: "MISSING_OR_GENERIC",
      message: `Which student did you mean? ${availableListMsg}`,
    };
  }

  const normalized = rawName.toLowerCase().trim();

  // 1. Exact match (case-insensitive & trimmed)
  const exactMatch = enrolledStudents.find(
    (s) => s.name.toLowerCase().trim() === normalized
  );
  if (exactMatch) {
    return { type: "SUCCESS", student: exactMatch };
  }

  // 2. Substring & word matches
  const matches = enrolledStudents.filter((s) => {
    const sName = s.name.toLowerCase().trim();
    const parts = sName.split(/\s*(?:&|and|,)\s*/);
    return (
      sName.includes(normalized) ||
      normalized.includes(sName) ||
      parts.some((part) => part && (normalized.includes(part) || part.includes(normalized)))
    );
  });

  if (matches.length === 1 && matches[0]) {
    return { type: "SUCCESS", student: matches[0] };
  }

  if (matches.length > 1) {
    return {
      type: "MULTIPLE_MATCHES",
      message: `Multiple students matched "${rawName}". Which student did you mean? Matching options: ${matches.map((m) => `"${m.name}"`).join(", ")}.`,
    };
  }

  return {
    type: "NOT_FOUND",
    message: `Could not find student matching "${rawName}". ${availableListMsg}`,
  };
}

function isGenericName(name: string): boolean {
  const norm = name.toLowerCase().trim();
  const genericWords = [
    "student",
    "the student",
    "a student",
    "user",
    "person",
    "someone",
    "unknown",
    "student name",
  ];
  return genericWords.includes(norm);
}

function parsePromptFallback(prompt: string, enrolledNames: string[]): unknown {
  const lower = prompt.toLowerCase();

  if (lower.includes("pending") || lower.includes("due") || lower.includes("unpaid")) {
    return { action: "QUERY_STATS", topic: "PENDING_FEES" };
  }

  if (lower.includes("revenue") || lower.includes("collected") || lower.includes("earnings")) {
    return { action: "QUERY_STATS", topic: "REVENUE" };
  }

  if (lower.includes("show students") || lower.includes("list students") || lower.includes("all students")) {
    return { action: "QUERY_STATS", topic: "STUDENT_LIST" };
  }

  const matchedName = enrolledNames.find((n) => {
    const parts = n.toLowerCase().split(/\s*(?:&|and|,)\s*/);
    return parts.some((p) => p.length > 2 && lower.includes(p.toLowerCase()));
  }) ?? null;

  let date = "today";
  if (lower.includes("tomorrow")) date = "tomorrow";
  if (lower.includes("yesterday")) date = "yesterday";

  if (lower.includes("delete") || lower.includes("remove")) {
    return { action: "DELETE_STUDENT_REQUEST", studentName: matchedName };
  }

  if (lower.includes("start")) {
    return { action: "START_CLASS", studentName: matchedName, date };
  }

  if (lower.includes("end")) {
    return { action: "END_CLASS", studentName: matchedName, date };
  }

  if (lower.includes("homework") || lower.includes("classwork") || lower.includes("topic") || lower.includes("note")) {
    const hwMatch = prompt.match(/(?:homework|hw):\s*(.+)/i);
    return {
      action: "ADD_SESSION_NOTE",
      studentName: matchedName,
      date,
      homework: hwMatch?.[1] || prompt,
    };
  }

  if (lower.includes("present") || lower.includes("absent") || lower.includes("cancelled") || lower.includes("took")) {
    let status = "PRESENT";
    if (lower.includes("absent")) status = "ABSENT";
    if (lower.includes("cancelled")) status = "CANCELLED";
    return { action: "RECORD_ATTENDANCE", studentName: matchedName, status, date };
  }

  if (lower.includes("payment") || lower.includes("paid") || lower.includes("₹") || lower.includes("rupees")) {
    const amountMatch = prompt.match(/(\d+)/);
    return {
      action: "RECORD_PAYMENT",
      studentName: matchedName,
      amount: amountMatch ? Number(amountMatch[1]) : 500,
      method: "UPI",
      date,
    };
  }

  return { action: "QUERY_STATS", topic: "STUDENT_LIST" };
}

function getRandomAvatarColor(): string {
  const colors = [
    "hsl(215 85% 55%)",
    "hsl(150 70% 45%)",
    "hsl(280 75% 60%)",
    "hsl(35 90% 55%)",
    "hsl(340 80% 58%)",
  ];
  return colors[Math.floor(Math.random() * colors.length)] ?? "hsl(215 85% 55%)";
}
