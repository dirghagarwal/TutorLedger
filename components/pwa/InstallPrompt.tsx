"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);\n  const [ios, setIos] = useState(false);\n  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();\n    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);\n    setIos(isIOSDevice && !window.navigator.standalone);\n\n    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent && !ios) return null;

  const install = async () => {
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      <Button
        aria-label="Install TutorLedger"
        className="fixed bottom-5 right-5 z-40 shadow-floating"
        size="sm"
        onClick={() => {
          if (ios) setShowIosHelp(true);
          else void install();
        }}
      >
        <Download /> Install app
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="w-[calc(100%-1rem)] border-border-strong bg-surface text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install TutorLedger on iPhone</DialogTitle>
            <DialogDescription>
              iPhone does not show the Android-style install prompt. Use Safari&apos;s Share menu to add TutorLedger to your Home Screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Share className="size-5 shrink-0 text-primary" />
              <span>1. Tap <strong className="text-foreground">Share</strong> in Safari.</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Download className="size-5 shrink-0 text-primary" />
              <span>2. Choose <strong className="text-foreground">Add to Home Screen</strong>.</span>
            </div>
            <p className="text-xs">If you don&apos;t see it, scroll to the bottom of the Share menu and choose <strong className="text-foreground">Edit Actions</strong>, then add it.</p>
          </div>
          <Button variant="outline" onClick={() => setShowIosHelp(false)}><X /> Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
