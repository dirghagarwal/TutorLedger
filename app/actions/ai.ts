"use server";

import { revalidatePath } from "next/cache";

import { recordAttendance, recordPayment } from "@/app/actions/workflow";
import { addStudent } from "@/app/actions/students";
import { findSessions } from "@/lib/repositories/sessions";
import { findStudents, findStudentByName } from "@/lib/repositories/students";
import {
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";
import { aiActionSchema } from "@/lib/validations/ai";
import { AttendanceStatus } from "@/types/attendance";
import { PaymentMethod, PaymentStatus } from "@/types/payment";
import { FeeType } from "@/types/students";

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
}

export async function processAiCommand(prompt: string): Promise<AiCommandResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: "Please type a prompt or query." };
  }

  const actionCandidate = parsePromptToCandidate(trimmed);
  const parseResult = aiActionSchema.safeParse(actionCandidate);

  if (!parseResult.success) {
    return {
      ok: false,
      message: `I didn't quite catch that structured request. Try asking something like:
• "Took Rahul class today" or "Mark Rahul present"
• "Add student Priya Physics 1500 monthly"
• "Record payment 2000 for Rahul"
• "Show pending fees"
• "Delete student Rahul" (Will ask for confirmation)`,
    };
  }

  const action = parseResult.data;

  switch (action.action) {
    case "RECORD_ATTENDANCE": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}". Please check the student's name.`,
        };
      }

      const today = new Date().toISOString().slice(0, 10);
      const allSessions = await findSessions();
      let todaySession = allSessions.find(
        (s) => s.studentId === student.id && s.date === today
      );

      if (!todaySession) {
        todaySession = allSessions.find((s) => s.studentId === student.id);
      }

      if (!todaySession) {
        return {
          ok: false,
          message: `No active class session found for ${student.name}. Please create a schedule slot first.`,
        };
      }

      const result = await recordAttendance({
        sessionId: todaySession.id,
        date: todaySession.date,
        startTime: todaySession.startTime,
        endTime: todaySession.endTime,
        status: action.status,
        notes: "Recorded via AI Command",
      });

      if (!result.ok) {
        return { ok: false, message: result.error };
      }

      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath(`/students/${student.id}`);
      return {
        ok: true,
        actionType: "RECORD_ATTENDANCE",
        message: `Marked ${student.name} as ${action.status} for session on ${todaySession.date}.`,
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
        return { ok: false, message: result.error };
      }

      revalidatePath("/students");
      revalidatePath("/");
      return {
        ok: true,
        actionType: "CREATE_STUDENT",
        message: `Successfully added student ${action.name} (${action.subject}) with ₹${action.fee} ${action.feeType.toLowerCase()} fee.`,
      };
    }

    case "RECORD_PAYMENT": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}".`,
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
        return { ok: false, message: result.error };
      }

      revalidatePath("/payments");
      revalidatePath(`/students/${student.id}`);
      revalidatePath("/");
      return {
        ok: true,
        actionType: "RECORD_PAYMENT",
        message: `Recorded payment of ₹${action.amount} for ${student.name} (${action.method}).`,
      };
    }

    case "QUERY_STATS": {
      const students = await findStudents();

      if (action.topic === "PENDING_FEES") {
        const totalPending = await getTotalOutstandingBalance(students);
        return {
          ok: true,
          actionType: "QUERY_STATS",
          message: `Total pending fees across all students: ₹${totalPending.toLocaleString("en-IN")}. Check the Payments page for student-wise breakdown.`,
        };
      }

      if (action.topic === "REVENUE") {
        const revenue = await getRevenueThisMonth();
        return {
          ok: true,
          actionType: "QUERY_STATS",
          message: `Total revenue collected this month: ₹${revenue.toLocaleString("en-IN")}.`,
        };
      }

      return {
        ok: true,
        actionType: "QUERY_STATS",
        message: `You currently have ${students.length} active students enrolled.`,
      };
    }

    case "DELETE_STUDENT_REQUEST": {
      const student = await findStudentByName(action.studentName);
      if (!student) {
        return {
          ok: false,
          message: `Could not find student matching "${action.studentName}" to delete.`,
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
      };
    }
  }
}

function parsePromptToCandidate(prompt: string): unknown {
  const lower = prompt.toLowerCase();

  // 1. Delete student pattern
  if (lower.includes("delete") || lower.includes("remove")) {
    const match = prompt.match(/(?:delete|remove)\s+(?:student\s+)?([A-Za-z0-9\s]+)/i);
    if (match?.[1]) {
      return {
        action: "DELETE_STUDENT_REQUEST",
        studentName: match[1].trim(),
      };
    }
  }

  // 2. Attendance patterns: "took rahul class", "mark rahul present", "rahul absent"
  if (lower.includes("present") || lower.includes("absent") || lower.includes("cancelled") || lower.includes("rescheduled") || lower.includes("took") || lower.includes("class")) {
    let status = AttendanceStatus.PRESENT;
    if (lower.includes("absent")) status = AttendanceStatus.ABSENT;
    if (lower.includes("cancelled") || lower.includes("canceled")) status = AttendanceStatus.CANCELLED;
    if (lower.includes("rescheduled")) status = AttendanceStatus.RESCHEDULED;

    const match = prompt.match(/(?:took|mark|attendance|class)?\s*([A-Za-z0-9]+)\s*(?:class|present|absent|cancelled|today)?/i);
    const candidateName = match?.[1] ? match[1].replace(/(?:took|mark|class|present|absent)/gi, "").trim() : "";

    if (candidateName) {
      return {
        action: "RECORD_ATTENDANCE",
        studentName: candidateName,
        status,
      };
    }
  }

  // 3. Payment pattern: "record payment 2000 for rahul", "paid 1500 rahul"
  if (lower.includes("payment") || lower.includes("paid") || lower.includes("received")) {
    const amountMatch = prompt.match(/(\d+)/);
    const nameMatch = prompt.match(/(?:for|from|student)?\s*([A-Za-z]+)/i);
    if (amountMatch) {
      return {
        action: "RECORD_PAYMENT",
        studentName: nameMatch?.[1] ?? "Rahul",
        amount: Number(amountMatch[1]),
        method: lower.includes("cash") ? PaymentMethod.CASH : PaymentMethod.UPI,
      };
    }
  }

  // 4. Create Student pattern: "add student priya physics 1500 monthly"
  if (lower.includes("add student") || lower.includes("new student")) {
    const parts = prompt.split(/\s+/);
    const name = parts[2] || "New Student";
    const subject = parts[3] || "Tuition";
    const amountMatch = prompt.match(/(\d+)/);
    const feeType = lower.includes("classwise") || lower.includes("class") ? FeeType.CLASSWISE : FeeType.MONTHLY;

    return {
      action: "CREATE_STUDENT",
      name,
      subject,
      fee: amountMatch ? Number(amountMatch[1]) : 1000,
      feeType,
    };
  }

  // 5. Query stats patterns
  if (lower.includes("pending") || lower.includes("due") || lower.includes("balance")) {
    return { action: "QUERY_STATS", topic: "PENDING_FEES" };
  }
  if (lower.includes("revenue") || lower.includes("earnings") || lower.includes("collected")) {
    return { action: "QUERY_STATS", topic: "REVENUE" };
  }
  if (lower.includes("students") || lower.includes("list")) {
    return { action: "QUERY_STATS", topic: "STUDENT_LIST" };
  }

  return null;
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
