"use server";

import { recordPaymentWithCoverage } from "@/app/actions/payment-recording";

const MONTHS: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12", jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };
function monthKey(name: string, year: string | undefined, fallbackDate: string) { const key = MONTHS[name.toLowerCase()]; if (!key) return null; return `${year ?? fallbackDate.slice(0, 4)}-${key}`; }
function dateKey(text: string, fallbackYear: string) { const m = text.trim().match(/^(\d{1,2})(?:st|nd|rd|th)?[\s/-]+([A-Za-z]+)(?:[\s/-]+(\d{4}))?$/); if (m) { const month = MONTHS[m[2]!.toLowerCase()]; if (month) return `${m[3] ?? fallbackYear}-${month}-${m[1]!.padStart(2, "0")}`; } const numeric = text.trim().match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/); if (numeric) return `${numeric[3] ?? fallbackYear}-${numeric[2]!.padStart(2, "0")}-${numeric[1]!.padStart(2, "0")}`; return null; }

export async function confirmAiPayment(data: Record<string, unknown>, originalPrompt: string) {
  const date = String(data.date ?? new Date().toISOString().slice(0, 10));
  const text = originalPrompt.toLowerCase();
  const billingPeriod = String(data.billingPeriod ?? "MONTHLY");
  if (billingPeriod === "MONTHLY") {
    const match = text.match(/(?:for|covering|covers?)\s+(?:the\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?/i);
    const coveredMonth = match ? monthKey(match[1]!, match[2], date) : date.slice(0, 7);
    return recordPaymentWithCoverage({ ...data, date, billingPeriod, coveredMonth, coveredFromDate: null, coveredToDate: null, coveredClassCount: null });
  }
  const countMatch = text.match(/(\d+)\s+classes?/i);
  const rangeMatch = text.match(/from\s+(.+?)\s+(?:to|until|through|upto)\s+(.+?)(?:$|[,.])/i);
  if (!countMatch || !rangeMatch) return { ok: false as const, error: "For a class-wise AI payment, specify the number of classes and the coverage range, e.g. '6 classes from 1 Sep to 20 Sep'." };
  const from = dateKey(rangeMatch[1]!, date.slice(0, 4)); const to = dateKey(rangeMatch[2]!, date.slice(0, 4));
  if (!from || !to) return { ok: false as const, error: "I could not resolve the class-wise coverage dates. Please give dates like '1 Sep to 20 Sep'." };
  return recordPaymentWithCoverage({ ...data, date, billingPeriod, coveredMonth: null, coveredFromDate: from, coveredToDate: to, coveredClassCount: Number(countMatch[1]) });
}
