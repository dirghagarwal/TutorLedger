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
import { formatDisplayDate, getTodayDateKey, parseRelativeDate, parseMultipleRelativeDates } from "@/lib/utils/date";
import { normalizeName, stringSimilarity } from "@/lib/utils/string";
import { aiSemanticOutputSchema, type AiSemanticOutput } from "@/lib/validations/ai";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod } from "@/types/payment";
import { SessionStatus } from "@/types/session";
import type { Student } from "@/types/students";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Intentionally ignore CLI context missing static store
  }
}

export interface ActiveSessionContext {
  studentId: string;
  studentName: string;
  sessionId: string;
  date: string;
  scheduleId: string;
}

export interface AiCommandResult {
  ok: boolean;
  message: string;
  actionType?: string;
  state?: "RESOLVED" | "NEEDS_CLARIFICATION" | "REQUIRES_CONFIRMATION" | "REQUIRES_STRONG_CONFIRMATION" | "BLOCKED";
  requiresConfirmation?: boolean;
  requiresClarification?: boolean;
  clarificationOptions?: string[];
  confirmationPayload?: {
    action: string;
    studentId?: string;
    studentName?: string;
    sessionId?: string;
    token?: string;
    details?: string;
  };
  activeContext?: ActiveSessionContext | null;
  data?: Record<string, unknown>;
  llmUsed?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function processAiCommand(
  prompt: string,
  history: ConversationMessage[] = [],
  activeContext?: ActiveSessionContext | null
): Promise<AiCommandResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: "Please enter a prompt or question.", activeContext };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: "GEMINI_API_KEY is not configured in server environment.",
      activeContext,
    };
  }

  const enrolledStudents = await findStudents();
  const enrolledNamesList = enrolledStudents.map((s) => s.name);
  const todayKolkataDate = getTodayDateKey();

  let semanticOutput: AiSemanticOutput;
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
            action: { type: SchemaType.STRING },
            studentReference: { type: SchemaType.STRING, nullable: true },
            dateReference: { type: SchemaType.STRING, nullable: true },
            dates: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
            status: { type: SchemaType.STRING, nullable: true },
            amount: { type: SchemaType.NUMBER, nullable: true },
            method: { type: SchemaType.STRING, nullable: true },
            topic: { type: SchemaType.STRING, nullable: true },
            classwork: { type: SchemaType.STRING, nullable: true },
            homework: { type: SchemaType.STRING, nullable: true },
            remarks: { type: SchemaType.STRING, nullable: true },
            queryTopic: { type: SchemaType.STRING, nullable: true },
            name: { type: SchemaType.STRING, nullable: true },
            subject: { type: SchemaType.STRING, nullable: true },
            fee: { type: SchemaType.NUMBER, nullable: true },
            feeType: { type: SchemaType.STRING, nullable: true },
            isCorrection: { type: SchemaType.BOOLEAN, nullable: true },
          },
          required: ["action"],
        },
      },
    });

    const systemPrompt = `You are TutorLedger's intelligent conversational assistant AI.
Today's date is ${todayKolkataDate} (Asia/Kolkata time zone).

Active Session Context: ${activeContext ? `Student: "${activeContext.studentName}" (ID: ${activeContext.studentId}), Session Date: ${activeContext.date}` : "None"}

Enrolled students in database:
${enrolledNamesList.length > 0 ? enrolledNamesList.map((n) => `- "${n}"`).join("\n") : "No enrolled students yet"}

NATURAL LANGUAGE & CONVERSATIONAL UNDERSTANDING RULES:
1. Parse natural human language regardless of case, typos, casual phrasing, or Hinglish ("took class", "paid 2k", "show pending", "delete Wednesday class", "who owes money").
2. Understand conversational context and corrections (e.g. "Actually Wednesday", "Sorry meant Aahan", "Add homework").
3. Extract semantic references ONLY if mentioned or implied. Set studentReference = null if omitted or unclear.
4. NEVER invent database IDs, calendar dates, or student names.
5. MULTI-DATE COMMANDS: When the user mentions multiple dates (e.g. "2nd and 9th August", "Wednesday and Friday"), return the array of dates in the 'dates' field as YYYY-MM-DD strings.
6. STRICT DELETION SEPARATION:
   - "DELETE_SESSION": For deleting a specific class/lesson (e.g. "Delete Wednesday class", "Remove yesterday's session").
   - "DELETE_STUDENT_REQUEST": ONLY for deleting an entire student profile (e.g. "Delete Viraj & Vivaan").`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }],
      })),
      { role: "user", parts: [{ text: `User request: "${trimmed}"` }] },
    ];

    const response = await model.generateContent({ contents });
    const rawJson = JSON.parse(response.response.text());
    semanticOutput = aiSemanticOutputSchema.parse(rawJson);
  } catch {
    semanticOutput = parsePromptFallback(trimmed, enrolledNamesList, history);
    modelName = "gemini-1.5-flash-latest (nlp-fallback)";
  }

  // Handle Action Intents using Context Priority Architecture
  switch (semanticOutput.action) {
    case "RECORD_ATTENDANCE": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const targetDates = resolveDatesWithContextPriority(
        semanticOutput.dates,
        semanticOutput.dateReference,
        trimmed,
        activeContext,
        studentRes.isStudentSwitch
      );

      const status = semanticOutput.status ?? AttendanceStatus.PRESENT;
      const results: { date: string; ok: boolean; error?: string }[] = [];
      let lastContext: ActiveSessionContext | null = activeContext;

      for (const targetDate of targetDates) {
        try {
          const session = await ensureSessionExists({ studentId: student.id, date: targetDate });
          const res = await recordAttendance({
            sessionId: session.id,
            studentId: student.id,
            scheduleId: session.scheduleId,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            status,
            notes: "Recorded via TutorLedger AI",
          });

          if (res.ok) {
            results.push({ date: targetDate, ok: true });
            lastContext = {
              studentId: student.id,
              studentName: student.name,
              sessionId: session.id,
              date: session.date,
              scheduleId: session.scheduleId,
            };
          } else {
            results.push({ date: targetDate, ok: false, error: res.error });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Database error";
          results.push({ date: targetDate, ok: false, error: errMsg });
        }
      }

      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (failed.length > 0 && succeeded.length === 0) {
        const errDetails = failed.map((f) => `Couldn't record ${student.name}'s ${formatDisplayDate(f.date)} class (${f.error}).`).join(" ");
        return { ok: false, state: "BLOCKED", message: errDetails, activeContext, llmUsed: modelName };
      }

      if (failed.length > 0 && succeeded.length > 0) {
        const succMsg = succeeded.map((s) => formatDisplayDate(s.date)).join(", ");
        const failMsg = failed.map((f) => `${formatDisplayDate(f.date)} (${f.error})`).join(", ");
        return {
          ok: true,
          state: "RESOLVED",
          actionType: "RECORD_ATTENDANCE",
          message: `Marked ${student.name} ${status} for ${succMsg}. Failed for: ${failMsg}.`,
          activeContext: lastContext,
          llmUsed: modelName,
        };
      }

      const dateStr = succeeded.map((s) => formatDisplayDate(s.date)).join(" & ");
      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
      return {
        ok: true,
        state: "RESOLVED",
        actionType: "RECORD_ATTENDANCE",
        message: `Marked ${student.name} ${status} for ${dateStr}.`,
        activeContext: lastContext,
        llmUsed: modelName,
      };
    }

    case "ADD_SESSION_NOTE": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: "Which class or student should I add this note/homework to?",
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const targetDate = resolveDatesWithContextPriority(
        semanticOutput.dates,
        semanticOutput.dateReference,
        trimmed,
        activeContext,
        studentRes.isStudentSwitch
      )[0]!;

      const session = await ensureSessionExists({ studentId: student.id, date: targetDate });

      const result = await addSessionNote({
        sessionId: session.id,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        topic: semanticOutput.topic || "Tuition Session Notes",
        classwork: semanticOutput.classwork || "",
        homework: semanticOutput.homework || "",
        remarks: semanticOutput.remarks || "",
      });

      if (!result.ok) return { ok: false, state: "BLOCKED", message: result.error, activeContext, llmUsed: modelName };

      const newContext: ActiveSessionContext = {
        studentId: student.id,
        studentName: student.name,
        sessionId: session.id,
        date: session.date,
        scheduleId: session.scheduleId,
      };

      safeRevalidate(`/students/${student.id}`);
      safeRevalidate("/calendar");
      return {
        ok: true,
        state: "RESOLVED",
        actionType: "ADD_SESSION_NOTE",
        message: `Saved notes/homework for ${student.name} on ${formatDisplayDate(session.date)}.`,
        activeContext: newContext,
        llmUsed: modelName,
      };
    }

    case "CREATE_STUDENT": {
      if (!semanticOutput.name || !semanticOutput.subject || !semanticOutput.fee) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: "Please specify the new student's name, subject, and fee (e.g. 'Add student Priya Physics 1500 monthly').",
          activeContext,
          llmUsed: modelName,
        };
      }

      const result = await addStudent({
        name: semanticOutput.name,
        subject: semanticOutput.subject,
        fee: semanticOutput.fee,
        feeType: semanticOutput.feeType ?? "MONTHLY",
        color: getRandomAvatarColor(),
        active: true,
      });

      if (!result.ok) {
        return { ok: false, state: "BLOCKED", message: result.error, activeContext, llmUsed: modelName };
      }

      safeRevalidate("/students");
      safeRevalidate("/");
      return {
        ok: true,
        state: "RESOLVED",
        actionType: "CREATE_STUDENT",
        message: `Successfully enrolled student ${semanticOutput.name} (${semanticOutput.subject}) with ₹${semanticOutput.fee} fee.`,
        activeContext: null,
        llmUsed: modelName,
      };
    }

    case "RECORD_PAYMENT": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const amount = semanticOutput.amount || 1000;
      const method = semanticOutput.method || PaymentMethod.UPI;

      const token = generateConfirmationToken({ studentId: student.id, action: "CONFIRM_RECORD_PAYMENT" });

      return {
        ok: true,
        state: "REQUIRES_CONFIRMATION",
        requiresConfirmation: true,
        actionType: "RECORD_PAYMENT",
        message: `⚠️ Record payment of ₹${amount} (${method}) for student "${student.name}"?`,
        confirmationPayload: {
          action: "CONFIRM_RECORD_PAYMENT",
          studentId: student.id,
          studentName: student.name,
          token,
          details: `Amount: ₹${amount} · Method: ${method} · Notes: Recorded via TutorLedger AI`,
        },
        data: {
          studentId: student.id,
          amount,
          method,
          notes: "Recorded via TutorLedger AI",
          token,
        },
        activeContext,
        llmUsed: modelName,
      };
    }

    case "DELETE_SESSION": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const targetDate = resolveDatesWithContextPriority(
        semanticOutput.dates,
        semanticOutput.dateReference,
        trimmed,
        activeContext,
        studentRes.isStudentSwitch
      )[0]!;

      const allSessions = await findSessions();
      const matchingSessions = allSessions.filter(
        (s) => s.studentId === student.id && s.date === targetDate
      );

      if (matchingSessions.length === 0) {
        return {
          ok: false,
          state: "BLOCKED",
          message: `No matching class found for ${student.name} on ${formatDisplayDate(targetDate)} (${targetDate}). No data was modified.`,
          activeContext,
          llmUsed: modelName,
        };
      }

      if (matchingSessions.length > 1) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: `I found multiple classes for ${student.name} on ${formatDisplayDate(targetDate)}. Which class time do you want to delete?`,
          clarificationOptions: matchingSessions.map((s) => `${s.startTime}–${s.endTime}`),
          activeContext,
          llmUsed: modelName,
        };
      }

      const session = matchingSessions[0]!;
      const token = generateConfirmationToken({ studentId: student.id, sessionId: session.id, action: "CONFIRM_DELETE_SESSION" });

      return {
        ok: true,
        state: "REQUIRES_CONFIRMATION",
        requiresConfirmation: true,
        actionType: "DELETE_SESSION",
        message: `⚠️ Delete class for ${student.name} on ${formatDisplayDate(session.date)}?`,
        confirmationPayload: {
          action: "CONFIRM_DELETE_SESSION",
          studentId: student.id,
          studentName: student.name,
          sessionId: session.id,
          token,
          details: `${student.name} · ${formatDisplayDate(session.date)} · ${session.startTime}–${session.endTime} (Deletes only this single class. Student & recurring schedule remain).`,
        },
        data: {
          sessionId: session.id,
          studentId: student.id,
          token,
        },
        activeContext,
        llmUsed: modelName,
      };
    }

    case "DELETE_STUDENT_REQUEST": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
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
        state: "REQUIRES_STRONG_CONFIRMATION",
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
        activeContext,
        llmUsed: modelName,
      };
    }

    case "START_CLASS": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const targetDate = getTodayDateKey();
      const session = await ensureSessionExists({ studentId: student.id, date: targetDate });

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.IN_PROGRESS,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      });

      if (!result.ok) return { ok: false, state: "BLOCKED", message: result.error, activeContext, llmUsed: modelName };

      const newContext: ActiveSessionContext = {
        studentId: student.id,
        studentName: student.name,
        sessionId: session.id,
        date: session.date,
        scheduleId: session.scheduleId,
      };

      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
      return {
        ok: true,
        state: "RESOLVED",
        actionType: "START_CLASS",
        message: `Started class for ${student.name} on ${formatDisplayDate(session.date)}. Status updated to IN_PROGRESS.`,
        activeContext: newContext,
        llmUsed: modelName,
      };
    }

    case "END_CLASS": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const targetDate = getTodayDateKey();
      const session = await ensureSessionExists({ studentId: student.id, date: targetDate });

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.COMPLETED,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
      });

      if (!result.ok) return { ok: false, state: "BLOCKED", message: result.error, activeContext, llmUsed: modelName };

      const newContext: ActiveSessionContext = {
        studentId: student.id,
        studentName: student.name,
        sessionId: session.id,
        date: session.date,
        scheduleId: session.scheduleId,
      };

      safeRevalidate("/");
      safeRevalidate("/calendar");
      safeRevalidate(`/students/${student.id}`);
      return {
        ok: true,
        state: "RESOLVED",
        actionType: "END_CLASS",
        message: `Ended class for ${student.name} on ${formatDisplayDate(session.date)}. Status updated to COMPLETED.`,
        activeContext: newContext,
        llmUsed: modelName,
      };
    }

    case "QUERY_STATS": {
      const topic = semanticOutput.queryTopic || "STUDENT_LIST";

      if (topic === "PENDING_FEES") {
        const totalPending = await getTotalOutstandingBalance(enrolledStudents);
        const pendingStudents = await getPendingStudents(enrolledStudents);
        const names = pendingStudents.map((s) => s.name).join(", ");
        return {
          ok: true,
          state: "RESOLVED",
          actionType: "QUERY_STATS",
          message: `Total pending fees: ₹${totalPending.toLocaleString("en-IN")}.${names ? ` Students with pending fees: ${names}.` : " No students currently have pending fees."}`,
          activeContext,
          llmUsed: modelName,
        };
      }

      if (topic === "REVENUE") {
        const revenue = await getRevenueThisMonth();
        return {
          ok: true,
          state: "RESOLVED",
          actionType: "QUERY_STATS",
          message: `Total revenue collected this month: ₹${revenue.toLocaleString("en-IN")}.`,
          activeContext,
          llmUsed: modelName,
        };
      }

      return {
        ok: true,
        state: "RESOLVED",
        actionType: "QUERY_STATS",
        message: `You currently have ${enrolledStudents.length} active students enrolled: ${enrolledStudents.map((s) => s.name).join(", ")}.`,
        activeContext,
        llmUsed: modelName,
      };
    }

    case "CONTEXT_SWITCH": {
      const studentRes = await resolveStudentWithContextPriority(
        semanticOutput.studentReference,
        enrolledStudents,
        history,
        activeContext
      );

      if (!studentRes.student) {
        return {
          ok: false,
          state: "NEEDS_CLARIFICATION",
          requiresClarification: true,
          message: studentRes.message,
          clarificationOptions: studentRes.options,
          activeContext,
          llmUsed: modelName,
        };
      }

      const student = studentRes.student;
      const newContext: ActiveSessionContext = {
        studentId: student.id,
        studentName: student.name,
        sessionId: "",
        date: activeContext?.date || getTodayDateKey(),
        scheduleId: "",
      };

      logAiAuditTrail({
        action: "CONTEXT_SWITCH",
        studentId: student.id,
        userPrompt: trimmed,
        result: `SUCCESS: Context switched to student ${student.name}. Zero DB mutations performed.`,
      });

      return {
        ok: true,
        state: "RESOLVED",
        actionType: "CONTEXT_SWITCH",
        message: `Got it — I'll use ${student.name} for your next action.`,
        activeContext: newContext,
        llmUsed: modelName,
      };
    }

    default: {
      return {
        ok: true,
        state: "RESOLVED",
        message: "I understood your message. How else can I assist with TutorLedger?",
        activeContext,
        llmUsed: modelName,
      };
    }
  }
}

async function resolveStudentWithContextPriority(
  studentRef: string | null | undefined,
  enrolledStudents: Student[],
  history: ConversationMessage[],
  activeContext?: ActiveSessionContext | null
): Promise<{ student: Student | null; isStudentSwitch: boolean; message: string; options: string[] }> {
  const options = enrolledStudents.map((s) => s.name);

  // Priority 1: Explicit student reference in prompt
  if (studentRef && !isGenericName(studentRef)) {
    const res = await resolveStudentEntity(studentRef, enrolledStudents, history);
    if (res.type === "SUCCESS") {
      const isSwitch = Boolean(activeContext && activeContext.studentId !== res.student.id);
      return { student: res.student, isStudentSwitch: isSwitch, message: "", options };
    }
    return { student: null, isStudentSwitch: false, message: res.message, options: res.options };
  }

  // Priority 2: Retained Active Session Context
  if (activeContext?.studentId) {
    const student = enrolledStudents.find((s) => s.id === activeContext.studentId);
    if (student) {
      return { student, isStudentSwitch: false, message: "", options };
    }
  }

  // Priority 3: Recent conversation history
  const historyRes = await resolveStudentEntity(null, enrolledStudents, history);
  if (historyRes.type === "SUCCESS") {
    const isSwitch = Boolean(activeContext && activeContext.studentId !== historyRes.student.id);
    return { student: historyRes.student, isStudentSwitch: isSwitch, message: "", options };
  }

  return {
    student: null,
    isStudentSwitch: false,
    message: "Which student did you mean? Select one below:",
    options,
  };
}

function resolveDatesWithContextPriority(
  explicitDates: string[] | null | undefined,
  dateRef: string | null | undefined,
  fullPrompt: string,
  activeContext?: ActiveSessionContext | null,
  isStudentSwitch: boolean = false
): string[] {
  if (explicitDates && explicitDates.length > 0) {
    const resolved = explicitDates.map((d) => parseRelativeDate(d, fullPrompt));
    return [...new Set(resolved)];
  }

  const multiDates = parseMultipleRelativeDates(dateRef, fullPrompt);
  const normPrompt = fullPrompt.toLowerCase();
  const hasExplicitDateWord =
    dateRef ||
    /\b(yesterday|today|tomorrow|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat|\d{1,2}(?:st|nd|rd|th)?)\b/i.test(normPrompt);

  if (hasExplicitDateWord && multiDates.length > 0) {
    return multiDates;
  }

  if (!isStudentSwitch && activeContext?.date) {
    return [activeContext.date];
  }

  return [getTodayDateKey()];
}

export type EntityResult =
  | { type: "SUCCESS"; student: Student }
  | { type: "MISSING_OR_GENERIC"; message: string; options: string[] }
  | { type: "MULTIPLE_MATCHES"; message: string; options: string[] }
  | { type: "NOT_FOUND"; message: string; options: string[] };

export async function resolveStudentEntity(
  rawName: string | null | undefined,
  enrolledStudents: Student[],
  history: ConversationMessage[] = []
): Promise<EntityResult> {
  const options = enrolledStudents.map((s) => s.name);

  let effectiveName = rawName;
  if ((!effectiveName || isGenericName(effectiveName)) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]?.content || "";
      const found = enrolledStudents.find((s) => {
        const parts = normalizeName(s.name).split(/\s+and\s+|\s+/);
        return parts.some((p) => p.length >= 3 && normalizeName(msg).includes(p));
      });
      if (found) {
        effectiveName = found.name;
        break;
      }
    }
  }

  if (!effectiveName || isGenericName(effectiveName)) {
    return {
      type: "MISSING_OR_GENERIC",
      message: enrolledStudents.length > 0
        ? "Which student did you mean? Select one below:"
        : "No enrolled students found. Please add a student first.",
      options,
    };
  }

  const normRaw = normalizeName(effectiveName);

  // 1. Exact normalized match
  const exactMatch = enrolledStudents.find(
    (s) => normalizeName(s.name) === normRaw
  );
  if (exactMatch) {
    return { type: "SUCCESS", student: exactMatch };
  }

  // 2. Substring & word matches
  const matches = enrolledStudents.filter((s) => {
    const normStudent = normalizeName(s.name);
    if (normStudent === normRaw) return true;
    const studentParts = normStudent.split(/\s+/).filter((p) => p !== "and" && p.length >= 2);
    const rawParts = normRaw.split(/\s+/).filter((p) => p !== "and" && p.length >= 2);
    return studentParts.some((sp) => rawParts.includes(sp)) || rawParts.some((rp) => studentParts.includes(rp));
  });

  if (matches.length === 1 && matches[0]) {
    return { type: "SUCCESS", student: matches[0] };
  }

  if (matches.length > 1) {
    const bestMatch = matches.find((m) => {
      const normM = normalizeName(m.name);
      return normM.includes(normRaw) || normRaw.includes(normM);
    });
    if (bestMatch) {
      return { type: "SUCCESS", student: bestMatch };
    }

    return {
      type: "MULTIPLE_MATCHES",
      message: `I found multiple students matching "${rawName || effectiveName}". Which one did you mean?`,
      options: matches.map((m) => m.name),
    };
  }

  // 3. Typo-tolerant similarity scoring (threshold >= 0.75)
  const scored = enrolledStudents
    .map((s) => ({ student: s, score: stringSimilarity(rawName || effectiveName || "", s.name) }))
    .filter((item) => item.score >= 0.75)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1 && scored[0]) {
    return { type: "SUCCESS", student: scored[0].student };
  }

  if (scored.length > 1 && scored[0] && scored[1] && scored[0].score > scored[1].score + 0.15) {
    return { type: "SUCCESS", student: scored[0].student };
  }

  return {
    type: "NOT_FOUND",
    message: `I couldn't find a student matching "${rawName}". Your enrolled students are:`,
    options,
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

function parsePromptFallback(
  prompt: string,
  enrolledNames: string[],
  history: ConversationMessage[] = []
): AiSemanticOutput {
  const lower = prompt.toLowerCase();

  let matchedName = enrolledNames.find((n) => {
    const parts = normalizeName(n).split(/\s+and\s+|\s+/);
    const words = lower.split(/\s+/);
    return parts.some((p) =>
      words.some((w) => w.length >= 3 && (w.includes(p) || p.includes(w) || stringSimilarity(w, p) >= 0.75))
    );
  }) ?? null;

  if (!matchedName && history.length > 0) {
    const lastUserMsg = [...history].reverse().find((h) => h.role === "user")?.content.toLowerCase() || "";
    matchedName = enrolledNames.find((n) => {
      const parts = normalizeName(n).split(/\s+and\s+|\s+/);
      return parts.some((p) => p.length >= 3 && lastUserMsg.includes(p));
    }) ?? null;
  }

  const isCorrectionPhrase =
    lower.includes("actually") ||
    lower.includes("meant") ||
    lower.includes("instead") ||
    lower.includes("wrong student") ||
    lower.includes("no,") ||
    lower.includes("sorry");

  const hasActionVerb =
    lower.includes("took") ||
    lower.includes("mark") ||
    lower.includes("add") ||
    lower.includes("start") ||
    lower.includes("end") ||
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("paid") ||
    lower.includes("payment") ||
    lower.includes("homework") ||
    lower.includes("remark") ||
    lower.includes("classwork");

  if (isCorrectionPhrase && !hasActionVerb && matchedName) {
    return {
      action: "CONTEXT_SWITCH",
      studentReference: matchedName,
    };
  }

  // Handle follow-up date corrections like "Actually Wednesday"
  if (
    lower.includes("actually") ||
    lower.includes("meant") ||
    lower.includes("instead") ||
    /\b(wednesday|monday|tuesday|thursday|friday|saturday|sunday)\b/.test(lower)
  ) {
    if (!lower.includes("delete") && !lower.includes("remove") && !lower.includes("payment")) {
      return {
        action: "RECORD_ATTENDANCE",
        studentReference: matchedName,
        status: AttendanceStatus.PRESENT,
        dateReference: prompt,
      };
    }
  }

  let dateReference: string | null = null;
  if (lower.includes("tomorrow")) dateReference = "tomorrow";
  if (lower.includes("yesterday")) dateReference = "yesterday";

  if ((lower.includes("delete") || lower.includes("remove")) && (lower.includes("class") || lower.includes("session") || lower.includes("wednesday") || lower.includes("monday") || lower.includes("tuesday") || lower.includes("thursday") || lower.includes("friday") || lower.includes("saturday") || lower.includes("sunday"))) {
    return { action: "DELETE_SESSION", studentReference: matchedName, dateReference: prompt };
  }

  if (lower.includes("delete") || lower.includes("remove")) {
    return { action: "DELETE_STUDENT_REQUEST", studentReference: matchedName };
  }

  if (lower.includes("start")) {
    return { action: "START_CLASS", studentReference: matchedName, dateReference: dateReference || "today" };
  }

  if (lower.includes("end") || lower.includes("finish")) {
    return { action: "END_CLASS", studentReference: matchedName, dateReference: dateReference || "today" };
  }

  if (lower.includes("homework") || lower.includes("classwork") || lower.includes("topic") || lower.includes("note") || lower.includes("remark")) {
    const hwMatch = prompt.match(/(?:homework|hw):\s*(.+)/i);
    const remarkMatch = prompt.match(/(?:remarks?|note):\s*(.+)/i);
    return {
      action: "ADD_SESSION_NOTE",
      studentReference: matchedName,
      dateReference,
      homework: hwMatch?.[1] || (lower.includes("homework") ? prompt : undefined),
      remarks: remarkMatch?.[1] || (lower.includes("remark") ? prompt : undefined),
      topic: lower.includes("topic") ? prompt : undefined,
    };
  }

  if (
    lower.includes("present") ||
    lower.includes("absent") ||
    lower.includes("cancelled") ||
    lower.includes("took") ||
    lower.includes("had") ||
    lower.includes("taught") ||
    lower.includes("taken") ||
    (lower.includes("record") && (lower.includes("class") || lower.includes("session") || lower.includes("attendance")))
  ) {
    let status = AttendanceStatus.PRESENT;
    if (lower.includes("absent")) status = AttendanceStatus.ABSENT;
    if (lower.includes("cancelled")) status = AttendanceStatus.CANCELLED;
    return { action: "RECORD_ATTENDANCE", studentReference: matchedName, status, dateReference: prompt };
  }

  if (lower.includes("payment") || lower.includes("paid") || lower.includes("₹") || lower.includes("rupees") || lower.includes("2k") || lower.includes("1k")) {
    const amountMatch = prompt.match(/(\d+)\s*k?/i);
    let amount = amountMatch ? Number(amountMatch[1]) : 1000;
    if (prompt.toLowerCase().includes("2k")) amount = 2000;
    if (prompt.toLowerCase().includes("1k")) amount = 1000;

    return {
      action: "RECORD_PAYMENT",
      studentReference: matchedName,
      amount,
      method: PaymentMethod.UPI,
      dateReference: dateReference || "today",
    };
  }

  return { action: "QUERY_STATS", queryTopic: "STUDENT_LIST" };
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
