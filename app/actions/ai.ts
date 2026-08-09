"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

import { addSessionNote } from "@/app/actions/sessions";
import { addStudent } from "@/app/actions/students";
import {
  recordAttendance,
  updateClassStatus,
} from "@/app/actions/workflow";
import { ensureSessionExists, findSessions } from "@/lib/repositories/sessions";
import { findStudents } from "@/lib/repositories/students";
import { generateConfirmationToken, logAiAuditTrail } from "@/lib/services/ai-safety";
import {
  getPendingStudents,
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";
import { formatDisplayDate, getTodayDateKey, parseRelativeDate } from "@/lib/utils/date";
import { aiActionSchema } from "@/lib/validations/ai";
import { SessionStatus } from "@/types/session";
import type { Student } from "@/types/students";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Intentionally ignore CLI context missing static store
  }
}

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
    sessionId?: string;
    token?: string;
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

STRICT DELETION RULES (MANDATORY SEPARATION):
1. Use "DELETE_SESSION" when user asks to delete, cancel, or remove a specific class, session, or lesson (e.g. "Delete Viraj's Wednesday class", "Remove yesterday's session").
2. Use "DELETE_STUDENT_REQUEST" ONLY when user asks to delete an entire student profile or remove a student completely (e.g. "Delete Viraj & Vivaan", "Remove student Viraj").
3. NEVER mix DELETE_SESSION and DELETE_STUDENT_REQUEST.

STRICT ENTITY EXTRACTION RULES:
1. Extract studentName ONLY if explicitly mentioned in user input.
2. NEVER invent a student name or use generic terms like "student", "the student", "user", "person", "someone".
3. If student name is omitted, unspecified, or ambiguous, return studentName = null.

STRICT DATE RULES:
- Extract date reference as mentioned (e.g. "Wednesday", "last Wednesday", "today", "yesterday", "5 August", "2026-08-05").
- DO NOT compute or alter calendar dates yourself.

Action Intent Schema:
- "QUERY_STATS": Asking about pending fees, revenue, or student list. Set topic to "PENDING_FEES", "REVENUE", or "STUDENT_LIST".
- "RECORD_ATTENDANCE": Set studentName, status ("PRESENT", "ABSENT", "CANCELLED", "RESCHEDULED"), and date.
- "RECORD_PAYMENT": Set studentName, amount (number), and optional method ("CASH", "UPI", "BANK_TRANSFER").
- "START_CLASS": Set studentName and date.
- "END_CLASS": Set studentName and date.
- "ADD_SESSION_NOTE": Set studentName, date, and homework, classwork, topic, or remarks.
- "CREATE_STUDENT": Set name, subject, fee (number), and feeType ("MONTHLY" or "CLASSWISE").
- "DELETE_SESSION": Set studentName and date when deleting a specific class/session.
- "DELETE_STUDENT_REQUEST": Set studentName when deleting an entire student record.`;

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

      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
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

      safeRevalidate("/students");
      safeRevalidate("/");
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
      const token = generateConfirmationToken({ studentId: student.id, action: "CONFIRM_RECORD_PAYMENT" });

      return {
        ok: true,
        requiresConfirmation: true,
        actionType: "RECORD_PAYMENT",
        message: `⚠️ Record payment of ₹${action.amount} (${action.method}) for student "${student.name}"?`,
        confirmationPayload: {
          action: "CONFIRM_RECORD_PAYMENT",
          studentId: student.id,
          studentName: student.name,
          token,
          details: `Amount: ₹${action.amount} · Method: ${action.method} · Notes: ${action.notes}`,
        },
        data: {
          studentId: student.id,
          amount: action.amount,
          method: action.method,
          notes: action.notes,
          token,
        },
        llmUsed: modelName,
      };
    }

    case "DELETE_SESSION": {
      const studentRes = await resolveStudentEntity(action.studentName, enrolledStudents);
      if (studentRes.type !== "SUCCESS") {
        return { ok: false, requiresClarification: true, message: studentRes.message, llmUsed: modelName };
      }
      const student = studentRes.student;
      const targetDate = parseRelativeDate(action.date, trimmed);

      const allSessions = await findSessions();
      const matchingSessions = allSessions.filter(
        (s) => s.studentId === student.id && s.date === targetDate
      );

      if (matchingSessions.length === 0) {
        return {
          ok: false,
          message: `No matching class found for ${student.name} on ${formatDisplayDate(targetDate)} (${targetDate}). No data was modified.`,
          llmUsed: modelName,
        };
      }

      if (matchingSessions.length > 1) {
        return {
          ok: false,
          requiresClarification: true,
          message: `I found multiple classes for ${student.name} on ${formatDisplayDate(targetDate)}. Which one do you want to delete? Available sessions: ${matchingSessions.map((s) => `${s.startTime}–${s.endTime}`).join(", ")}.`,
          llmUsed: modelName,
        };
      }

      const session = matchingSessions[0]!;
      const token = generateConfirmationToken({ studentId: student.id, sessionId: session.id, action: "CONFIRM_DELETE_SESSION" });

      return {
        ok: true,
        requiresConfirmation: true,
        actionType: "DELETE_SESSION",
        message: `⚠️ Delete class for ${student.name} on ${formatDisplayDate(session.date)}?`,
        confirmationPayload: {
          action: "CONFIRM_DELETE_SESSION",
          studentId: student.id,
          studentName: student.name,
          sessionId: session.id,
          token,
          details: `${student.name} · ${formatDisplayDate(session.date)} · ${session.startTime}–${session.endTime} (Deletes only this single class. Student & recurring schedule will remain).`,
        },
        data: {
          sessionId: session.id,
          studentId: student.id,
          token,
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

      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "START_CLASS",
        message: `Started class for ${student.name} on ${formatDisplayDate(session.date)}. Status updated to IN_PROGRESS.`,
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

      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "END_CLASS",
        message: `Ended class for ${student.name} on ${formatDisplayDate(session.date)}. Status updated to COMPLETED.`,
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

      safeRevalidate(`/students/${student.id}`);
      safeRevalidate("/calendar");
      return {
        ok: true,
        actionType: "ADD_SESSION_NOTE",
        message: `Saved session notes for ${student.name} on ${formatDisplayDate(session.date)}.`,
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
      const token = generateConfirmationToken({ studentId: student.id, action: "CONFIRM_DELETE_STUDENT" });

      logAiAuditTrail({
        action: "DELETE_STUDENT_REQUEST",
        studentId: student.id,
        userPrompt: trimmed,
        result: "REQUIRES_STRONG_CONFIRMATION: User must type DELETE <STUDENT_NAME> in modal",
      });

      return {
        ok: true,
        requiresConfirmation: true,
        actionType: "DELETE_STUDENT_REQUEST",
        message: `🚨 PERMANENT STUDENT DELETION REQUESTED for "${student.name}". Strong confirmation required!`,
        confirmationPayload: {
          action: "CONFIRM_DELETE_STUDENT",
          studentId: student.id,
          studentName: student.name,
          token,
          details: `Subject: ${student.subject} · Fee: ₹${student.fee} (${student.feeType}) · Deleting this student will permanently erase all associated schedules, sessions, notes, and payments.`,
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

  // STRICT SEPARATION FOR FALLBACK:
  // If prompt explicitly mentions "class" or "session", fallback to DELETE_SESSION
  if ((lower.includes("delete") || lower.includes("remove")) && (lower.includes("class") || lower.includes("session") || lower.includes("wednesday") || lower.includes("monday") || lower.includes("tuesday") || lower.includes("thursday") || lower.includes("friday") || lower.includes("saturday") || lower.includes("sunday"))) {
    return { action: "DELETE_SESSION", studentName: matchedName, date: prompt };
  }

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
