"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useSyncExternalStore, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribe() {
  return () => undefined;
}

function getIsIosBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return ios && !standalone;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const isIos = useSyncExternalStore(subscribe, getIsIosBrowser, () => false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent && !isIos) return null;

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      <Button
        aria-label="Install TutorLedger"
        className="fixed bottom-safe right-4 z-40 min-h-11 rounded-xl shadow-floating"
        size="sm"
        onClick={() => {
          if (isIos) setShowIosHelp(true);
          else void install();
        }}
      >
        <Download /> Install app
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="w-[calc(100%-1rem)] border-border-strong bg-surface text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install TutorLedger on iPhone or iPad</DialogTitle>
            <DialogDescription>iOS uses Safari&apos;s Share menu instead of the Android-style install prompt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"><Share className="size-5 shrink-0 text-primary" /><span>1. Open TutorLedger in Safari and tap <strong className="text-foreground">Share</strong>.</span></div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"><Download className="size-5 shrink-0 text-primary" /><span>2. Choose <strong className="text-foreground">Add to Home Screen</strong>.</span></div>
            <p className="text-xs leading-5">If the option is hidden, use <strong className="text-foreground">Edit Actions</strong> in the Share menu to add it.</p>
          </div>
          <Button variant="outline" onClick={() => setShowIosHelp(false)}><X /> Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
