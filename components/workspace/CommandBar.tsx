"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, XCircle, Trash2 } from "lucide-react";

import { processAiCommand, type AiCommandResult } from "@/app/actions/ai";
import { deleteSessionAction } from "@/app/actions/sessions";
import { deleteStudent } from "@/app/actions/students";
import { recordPayment } from "@/app/actions/workflow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PaymentMethod, PaymentStatus } from "@/types/payment";

const samplePrompts = [
  "Took Aahan class today",
  "Add student Priya Physics 1500 monthly",
  "Record payment 2000 for Rahul",
  "Show pending fees",
  "Delete Viraj Wednesday class",
];

export default function CommandBar() {
  const router = useRouter();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AiCommandResult | null>(null);

  // Strong Student Deletion State
  const [strongDeleteStudent, setStrongDeleteStudent] = useState<{
    id: string;
    name: string;
    details?: string;
  } | null>(null);
  const [typedConfirmName, setTypedConfirmName] = useState("");

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim() || isPending) return;

    setResult(null);
    startTransition(async () => {
      const res = await processAiCommand(prompt);
      setResult(res);
      if (res.ok && !res.requiresConfirmation) {
        toast({ title: "AI Command Executed", variant: "success" });
        router.refresh();
      }
    });
  }

  async function handleConfirmDeleteSession(sessionId: string) {
    startTransition(async () => {
      const res = await deleteSessionAction(sessionId);
      if (!res.ok) {
        toast({ title: "Class deletion failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Class deleted", description: "This single class was deleted. Student and recurring schedule remain intact.", variant: "success" });
      setResult({
        ok: true,
        message: "Successfully deleted single class. Student profile and recurring schedule are preserved.",
      });
      router.refresh();
    });
  }

  async function handleConfirmDeleteStudent(studentId: string) {
    startTransition(async () => {
      const res = await deleteStudent(studentId);
      if (!res.ok) {
        toast({ title: "Student deletion failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Student permanently deleted", variant: "success" });
      setStrongDeleteStudent(null);
      setTypedConfirmName("");
      setResult({
        ok: true,
        message: "Student record and all associated history were permanently deleted.",
      });
      router.refresh();
    });
  }

  async function handleConfirmPayment(data: Record<string, unknown>) {
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await recordPayment({
        studentId: String(data.studentId),
        amount: Number(data.amount),
        date: today,
        method: (data.method as PaymentMethod) || PaymentMethod.UPI,
        status: PaymentStatus.PAID,
        billingPeriod: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
        notes: String(data.notes || "Recorded via Gemini AI"),
      });

      if (!res.ok) {
        toast({ title: "Payment recording failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Payment recorded", variant: "success" });
      setResult({
        ok: true,
        message: `Successfully recorded payment of ₹${data.amount}.`,
      });
      router.refresh();
    });
  }

  const isStrongConfirmValid = Boolean(
    strongDeleteStudent &&
      typedConfirmName.trim().toUpperCase() === `DELETE ${strongDeleteStudent.name.toUpperCase()}`
  );

  return (
    <div className="mt-6 mb-8 space-y-4">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-primary pointer-events-none">
          <Sparkles className="size-5" />
        </div>

        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="✨ Ask AI: 'Took Rahul class today', 'Add student Priya', 'Record payment 2000'..."
          className="w-full rounded-2xl border border-input bg-card py-4 pl-12 pr-14 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 shadow-card"
        />

        <Button
          type="submit"
          disabled={isPending || !prompt.trim()}
          className="absolute right-3 size-9 p-0 rounded-xl"
          size="sm"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>

      {/* Quick Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Try asking:</span>
        {samplePrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPrompt(p);
            }}
            className="rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* AI Result Card */}
      {result && (
        <Card className={`border ${result.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"} text-foreground shadow-lg transition-all`}>
          <CardContent className="flex flex-col gap-3 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {result.requiresConfirmation ? (
                  <AlertTriangle className="size-5 text-warning shrink-0" />
                ) : result.ok ? (
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                ) : (
                  <XCircle className="size-5 text-destructive shrink-0" />
                )}
                <div>
                  <p className="font-medium">{result.message}</p>
                  {result.llmUsed && (
                    <p className="mt-1 text-[10px] font-mono text-primary/80">
                      ✨ Powered by Gemini ({result.llmUsed})
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setResult(null)}
              >
                Dismiss
              </Button>
            </div>

            {/* Confirmation Card for Session Delete / Payment */}
            {result.requiresConfirmation && result.confirmationPayload && (
              <div className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-warning text-xs">
                    {result.confirmationPayload.studentName || "Action Confirmation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.confirmationPayload.details}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResult(null)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  {result.confirmationPayload.action === "CONFIRM_DELETE_SESSION" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleConfirmDeleteSession(result.data?.sessionId as string)}
                      className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : "Delete Class Only"}
                    </Button>
                  ) : result.confirmationPayload.action === "CONFIRM_DELETE_STUDENT" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setStrongDeleteStudent({
                          id: result.confirmationPayload!.studentId!,
                          name: result.confirmationPayload!.studentName!,
                          details: result.confirmationPayload!.details,
                        });
                      }}
                      className="h-8 text-xs"
                    >
                      Strong Confirmation...
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isPending}
                      onClick={() => handleConfirmPayment(result.data!)}
                      className="h-8 text-xs bg-success text-success-foreground hover:bg-success/90"
                    >
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : "Confirm Payment"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strong Student Deletion Protection Modal */}
      {strongDeleteStudent && (
        <Dialog open={Boolean(strongDeleteStudent)} onOpenChange={(open) => { if (!open) setStrongDeleteStudent(null); }}>
          <DialogContent className="max-w-md rounded-2xl bg-surface border-destructive/40">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-5" /> Permanent Student Deletion
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs pt-1">
                You are about to permanently delete student <strong className="text-foreground">{strongDeleteStudent.name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                <p className="font-semibold">⚠️ WARNING: PERMANENT DATA LOSS</p>
                <p>Deleting a student permanently erases:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  <li>Student Profile & Fee Configuration</li>
                  <li>All Recurring Schedules</li>
                  <li>All Historical Sessions & Attendance</li>
                  <li>All Session Notes, Classwork & Homework</li>
                  <li>All Attachments & Payment Records</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  To confirm, type <span className="font-mono font-bold text-destructive">DELETE {strongDeleteStudent.name.toUpperCase()}</span> below:
                </label>
                <input
                  type="text"
                  value={typedConfirmName}
                  onChange={(e) => setTypedConfirmName(e.target.value)}
                  placeholder={`DELETE ${strongDeleteStudent.name.toUpperCase()}`}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStrongDeleteStudent(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!isStrongConfirmValid || isPending}
                  onClick={() => handleConfirmDeleteStudent(strongDeleteStudent.id)}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Permanently Delete Student"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
