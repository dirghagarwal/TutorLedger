"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Trash2 } from "lucide-react";

import { processAiCommand, type AiCommandResult, type ConversationMessage, type ActiveSessionContext } from "@/app/actions/ai";
import { deleteSessionAction } from "@/app/actions/sessions";
import { deleteStudent } from "@/app/actions/students";
import { recordPayment } from "@/app/actions/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PaymentMethod, PaymentStatus } from "@/types/payment";

const samplePrompts = [
  "Took Aahan class today",
  "Add student Priya Physics 1500 monthly",
  "Who owes me money?",
  "Aahan paid 2k",
  "Delete Viraj Wednesday class",
];

export default function CommandBar() {
  const router = useRouter();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AiCommandResult | null>(null);

  // Conversational History & Retained Active Session Context State
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [activeContext, setActiveContext] = useState<ActiveSessionContext | null>(null);

  // Strong Student Deletion State
  const [strongDeleteStudent, setStrongDeleteStudent] = useState<{
    id: string;
    name: string;
    details?: string;
  } | null>(null);
  const [typedConfirmName, setTypedConfirmName] = useState("");

  async function executePrompt(inputPrompt: string) {
    if (!inputPrompt.trim() || isPending) return;

    setResult(null);
    const newHistory: ConversationMessage[] = [...history, { role: "user", content: inputPrompt }];

    startTransition(async () => {
      const res = await processAiCommand(inputPrompt, newHistory, activeContext);
      setResult(res);

      if (res.activeContext !== undefined) {
        setActiveContext(res.activeContext);
      }

      if (res.ok && res.state === "RESOLVED") {
        toast({ title: "AI Command Executed", variant: "success" });
        setHistory([...newHistory, { role: "assistant", content: res.message }]);
        router.refresh();
      } else {
        setHistory([...newHistory, { role: "assistant", content: res.message }]);
      }
    });
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    await executePrompt(prompt);
    setPrompt("");
  }

  async function handleOptionSelect(option: string) {
    const clarificationPrompt = `${prompt ? `${prompt} ` : ""}${option}`.trim();
    setPrompt("");
    await executePrompt(clarificationPrompt);
  }

  async function handleConfirmDeleteSession(sessionId: string) {
    startTransition(async () => {
      const res = await deleteSessionAction(sessionId);
      if (!res.ok) {
        toast({ title: "Class deletion failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Class deleted", description: "This single class was deleted. Student and recurring schedule remain intact.", variant: "success" });
      setActiveContext(null);
      setResult({
        ok: true,
        state: "RESOLVED",
        message: "Successfully deleted single class. Student profile and recurring schedule are preserved.",
        activeContext: null,
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
      setActiveContext(null);
      setResult({
        ok: true,
        state: "RESOLVED",
        message: "Student record and all associated history were permanently deleted.",
        activeContext: null,
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
        notes: String(data.notes || "Recorded via TutorLedger AI"),
      });

      if (!res.ok) {
        toast({ title: "Payment recording failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Payment recorded", variant: "success" });
      setResult({
        ok: true,
        state: "RESOLVED",
        message: `Successfully recorded payment of ₹${data.amount}.`,
        activeContext,
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
          <Sparkles className="size-5 animate-pulse" />
        </div>

        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask TutorLedger anything… (e.g. 'Took Aahan class today', 'Who owes money?', 'Aahan paid 2k')"
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

      {/* Helper Bar & Active Context Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Try asking:</span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPrompt(p);
              }}
              className="rounded-lg border border-border/60 bg-muted/50 px-2 py-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeContext && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5">
              Target: {activeContext.studentName} ({activeContext.date})
            </Badge>
          )}
          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
            ✨ Powered by Gemini
          </span>
        </div>
      </div>

      {/* AI Processing Status */}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse px-1">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Thinking & resolving request…</span>
        </div>
      )}

      {/* AI Result & Clarification Card */}
      {result && !isPending && (
        <Card
          className={`border ${
            result.state === "RESOLVED"
              ? "border-success/30 bg-success/5"
              : result.state === "NEEDS_CLARIFICATION"
              ? "border-primary/30 bg-primary/5"
              : result.state === "REQUIRES_CONFIRMATION" || result.state === "REQUIRES_STRONG_CONFIRMATION"
              ? "border-warning/30 bg-warning/5"
              : "border-destructive/30 bg-destructive/5"
          } text-foreground shadow-lg transition-all`}
        >
          <CardContent className="flex flex-col gap-3 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {result.state === "RESOLVED" ? (
                  <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                ) : result.state === "NEEDS_CLARIFICATION" ? (
                  <HelpCircle className="size-5 text-primary shrink-0 mt-0.5" />
                ) : result.state === "REQUIRES_CONFIRMATION" || result.state === "REQUIRES_STRONG_CONFIRMATION" ? (
                  <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-mono px-1.5 py-0 ${
                        result.state === "RESOLVED"
                          ? "border-success/30 text-success bg-success/10"
                          : result.state === "NEEDS_CLARIFICATION"
                          ? "border-primary/30 text-primary bg-primary/10"
                          : "border-warning/30 text-warning bg-warning/10"
                      }`}
                    >
                      {result.state === "NEEDS_CLARIFICATION"
                        ? "Need a little more information"
                        : result.state === "REQUIRES_CONFIRMATION" || result.state === "REQUIRES_STRONG_CONFIRMATION"
                        ? "Please confirm"
                        : result.state === "RESOLVED"
                        ? "Done"
                        : "Notice"}
                    </Badge>
                  </div>

                  <p className="mt-1.5 font-medium leading-relaxed">{result.message}</p>

                  {result.llmUsed && (
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                      {result.llmUsed}
                    </p>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground shrink-0"
                onClick={() => setResult(null)}
              >
                Dismiss
              </Button>
            </div>

            {/* Interactive Clarification Option Chips */}
            {result.requiresClarification && result.clarificationOptions && result.clarificationOptions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                <p className="text-xs font-semibold text-primary">Select an option:</p>
                <div className="flex flex-wrap gap-2">
                  {result.clarificationOptions.map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant="outline"
                      onClick={() => handleOptionSelect(option)}
                      className="h-8 text-xs border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
