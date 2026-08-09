"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { processAiCommand, type AiCommandResult } from "@/app/actions/ai";
import { deleteStudent } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

const samplePrompts = [
  "Took Aahan class today",
  "Add student Priya Physics 1500 monthly",
  "Record payment 2000 for Rahul",
  "Show pending fees",
  "Delete student Test",
];

export default function CommandBar() {
  const router = useRouter();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AiCommandResult | null>(null);

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

  async function handleConfirmDelete(studentId: string) {
    startTransition(async () => {
      const res = await deleteStudent(studentId);
      if (!res.ok) {
        toast({ title: "Deletion failed", description: res.error, variant: "error" });
        return;
      }

      toast({ title: "Student deleted", variant: "success" });
      setResult({
        ok: true,
        message: "Student record was successfully deleted.",
      });
      router.refresh();
    });
  }

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
                <p className="font-medium">{result.message}</p>
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

            {/* Confirmation Card for Destructive Actions */}
            {result.requiresConfirmation && result.confirmationPayload?.studentId && (
              <div className="mt-2 rounded-xl border border-warning/30 bg-warning/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-warning text-xs">
                    {result.confirmationPayload.studentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.confirmationPayload.details}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResult(null)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleConfirmDelete(result.confirmationPayload!.studentId!)}
                    className="h-8 text-xs"
                  >
                    {isPending ? <Loader2 className="size-3 animate-spin" /> : "Confirm Delete"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
