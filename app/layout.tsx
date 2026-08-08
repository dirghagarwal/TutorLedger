import type { Metadata } from "next";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import ColorWaveLoader from "@/components/ui/ColorWaveLoader";
import { ToastProvider } from "@/components/ui/toast";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorLedger",
  description: "AI Powered Tuition Management",
  applicationName: "TutorLedger",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TutorLedger", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.svg", apple: "/icons/icon-192.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <ToastProvider>
          <ColorWaveLoader />
          {children}
          <ServiceWorkerRegistration />
          <InstallPrompt />
        </ToastProvider>
      </body>
    </html>
  );
}
