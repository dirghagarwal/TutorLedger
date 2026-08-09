"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

import { addSessionNote } from "@/app/actions/sessions";
import { addStudent } from "@/app/actions/students";
import {
  recordAttendance,
  recordPayment,
  updateClassStatus,
} from "@/app/actions/workflow";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudentByName, findStudents } from "@/lib/repositories/students";
import {
  getPendingStudents,
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";
import { aiActionSchema } from "@/lib/validations/ai";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod, PaymentStatus } from "@/types/payment";
import { SessionStatus } from "@/types/session";

export interface AiCommandResult {
  ok: boolean;
  message: string;
  actionType?: string;
  requiresConfirmation?: boolean;
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
            studentName: { type: SchemaType.STRING },
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

    const systemPrompt = `You are the AI Assistant for TutorLedger tuition management app.
Interpret user natural language commands into a single structured JSON intent object matching our action schemas.
Today's date is ${new Date().toISOString().slice(0, 10)}.

Supported actions:
1. "QUERY_STATS": Use when asking about pending fees, revenue, student lists, or unpaid fees. Set topic to "PENDING_FEES", "REVENUE", or "STUDENT_LIST".
2. "RECORD_ATTENDANCE": Set studentName and status ("PRESENT", "ABSENT", "CANCELLED", "RESCHEDULED").
3. "RECORD_PAYMENT": Set studentName, amount (number), and method ("CASH", "UPI", "BANK_TRANSFER").
4. "START_CLASS": Set studentName.
5. "END_CLASS": Set studentName.
6. "ADD_SESSION_NOTE": Set studentName, and homework, classwork, topic, or remarks.
7. "CREATE_STUDENT": Set name, subject, fee (number), and feeType ("MONTHLY" or "CLASSWISE").
8. "DELETE_STUDENT_REQUEST": Set studentName.`;

    const response = await model.generateContent([systemPrompt, `User command: "${trimmed}"`]);
    const text = response.response.text();
    rawLlmOutput = JSON.parse(text);
  } catch {
    // If Gemini API returns 429 rate limit / quota error or model unavailable, parse structured intent as fallback
    rawLlmOutput = parsePromptFallback(trimmed);
    modelName = "gemini-1.5-flash-latest (quota fallback)";
  }

  // Zod Validation of Structured LLM Output
  const parseResult = aiActionSchema.safeParse(rawLlmOutput);

  if (!parseResult.success) {
    return {
      ok: false,
      message: `Action schema validation failed: ${parseResult.error.issues[0]?.message ?? "Invalid format."}`,
      llmUsed: modelName,
    };
  }

  const action = parseResult.data;

  // Execute Action via existing server actions & services
  switch (action.action) {
    case "RECORD_ATTENDANCE": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}".`,
          llmUsed: modelName,
        };
      }

      const today = action.date || new Date().toISOString().slice(0, 10);
      const allSessions = await findSessions();
      const session = allSessions.find(
        (s) => s.studentId === student.id && s.date === today
      ) ?? allSessions.find((s) => s.studentId === student.id);

      if (!session) {
        return {
          ok: false,
          message: `No class session found for ${student.name}. Please set up a schedule first.`,
          llmUsed: modelName,
        };
      }

      const result = await recordAttendance({
        sessionId: session.id,
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
        message: `Marked ${student.name} as ${action.status} for session on ${session.date}.`,
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
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}".`,
          llmUsed: modelName,
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const result = await recordPayment({
        studentId: student.id,
        amount: action.amount,
        date: today,
        method: action.method,
        status: PaymentStatus.PAID,
        billingPeriod: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
        notes: action.notes,
      });

      if (!result.ok) {
        return { ok: false, message: result.error, llmUsed: modelName };
      }

      revalidatePath("/payments");
      revalidatePath(`/students/${student.id}`);
      revalidatePath("/");
      return {
        ok: true,
        actionType: "RECORD_PAYMENT",
        message: `Recorded payment of ₹${action.amount} for ${student.name} (${action.method}).`,
        llmUsed: modelName,
      };
    }

    case "START_CLASS": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return { ok: false, message: `Could not find student "${action.studentName}".`, llmUsed: modelName };
      }

      const allSessions = await findSessions();
      const session = allSessions.find((s) => s.studentId === student.id);
      if (!session) {
        return { ok: false, message: `No active session found for ${student.name}.`, llmUsed: modelName };
      }

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.IN_PROGRESS,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
      });
      if (!result.ok) return { ok: false, message: result.error, llmUsed: modelName };

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "START_CLASS",
        message: `Started class for ${student.name}. Status updated to IN_PROGRESS.`,
        llmUsed: modelName,
      };
    }

    case "END_CLASS": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return { ok: false, message: `Could not find student "${action.studentName}".`, llmUsed: modelName };
      }

      const allSessions = await findSessions();
      const session = allSessions.find((s) => s.studentId === student.id);
      if (!session) {
        return { ok: false, message: `No active session found for ${student.name}.`, llmUsed: modelName };
      }

      const result = await updateClassStatus({
        sessionId: session.id,
        status: SessionStatus.COMPLETED,
        studentId: student.id,
        scheduleId: session.scheduleId,
        date: session.date,
      });
      if (!result.ok) return { ok: false, message: result.error, llmUsed: modelName };

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "END_CLASS",
        message: `Ended class for ${student.name}. Status updated to COMPLETED.`,
        llmUsed: modelName,
      };
    }

    case "ADD_SESSION_NOTE": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return { ok: false, message: `Could not find student "${action.studentName}".`, llmUsed: modelName };
      }

      const allSessions = await findSessions();
      const session = allSessions.find((s) => s.studentId === student.id);
      if (!session) {
        return { ok: false, message: `No active session found for ${student.name}.`, llmUsed: modelName };
      }

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
        message: `Saved session notes for ${student.name}.`,
        llmUsed: modelName,
      };
    }

    case "QUERY_STATS": {
      const students = await findStudents();

      if (action.topic === "PENDING_FEES") {
        const totalPending = await getTotalOutstandingBalance(students);
        const pendingStudents = await getPendingStudents(students);
        const names = pendingStudents.map((s) => s.name).join(", ");
        return {
          ok: true,
          actionType: "QUERY_STATS",
          message: `Total pending fees: ₹${totalPending.toLocaleString("en-IN")}.${names ? ` Students with pending fees: ${names}.` : " No students have pending fees."}`,
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
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}" to delete.`,
          llmUsed: modelName,
        };
      }

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

function parsePromptFallback(prompt: string): unknown {
  const lower = prompt.toLowerCase();

  if (lower.includes("delete") || lower.includes("remove")) {
    const match = prompt.match(/(?:delete|remove)\s+(?:student\s+)?([A-Za-z0-9\s]+)/i);
    return { action: "DELETE_STUDENT_REQUEST", studentName: match?.[1]?.trim() || "Student" };
  }

  if (lower.includes("start")) {
    const match = prompt.match(/(?:start)\s+([A-Za-z0-9]+)/i);
    return { action: "START_CLASS", studentName: match?.[1]?.trim() || "Student" };
  }

  if (lower.includes("end")) {
    const match = prompt.match(/(?:end)\s+([A-Za-z0-9]+)/i);
    return { action: "END_CLASS", studentName: match?.[1]?.trim() || "Student" };
  }

  if (lower.includes("homework") || lower.includes("classwork") || lower.includes("topic") || lower.includes("note")) {
    const match = prompt.match(/(?:for|student)?\s*([A-Za-z]+)/i);
    const hwMatch = prompt.match(/(?:homework|hw):\s*(.+)/i);
    return {
      action: "ADD_SESSION_NOTE",
      studentName: match?.[1] || "Student",
      homework: hwMatch?.[1] || prompt,
    };
  }

  if (lower.includes("present") || lower.includes("absent") || lower.includes("cancelled") || lower.includes("took")) {
    let status = AttendanceStatus.PRESENT;
    if (lower.includes("absent")) status = AttendanceStatus.ABSENT;
    if (lower.includes("cancelled")) status = AttendanceStatus.CANCELLED;
    const match = prompt.match(/(?:took|mark)?\s*([A-Za-z0-9]+)/i);
    return { action: "RECORD_ATTENDANCE", studentName: match?.[1] || "Student", status };
  }

  if (lower.includes("payment") || lower.includes("paid") || lower.includes("₹") || lower.includes("rupees")) {
    const amountMatch = prompt.match(/(\d+)/);
    const nameMatch = prompt.match(/(?:for|from|student)?\s*([A-Za-z]+)/i);
    return {
      action: "RECORD_PAYMENT",
      studentName: nameMatch?.[1] || "Student",
      amount: amountMatch ? Number(amountMatch[1]) : 500,
      method: PaymentMethod.UPI,
    };
  }

  if (lower.includes("pending") || lower.includes("due") || lower.includes("unpaid")) {
    return { action: "QUERY_STATS", topic: "PENDING_FEES" };
  }

  if (lower.includes("revenue") || lower.includes("collected")) {
    return { action: "QUERY_STATS", topic: "REVENUE" };
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
