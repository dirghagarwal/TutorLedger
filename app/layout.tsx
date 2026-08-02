import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TutorLedger",
  description: "AI Powered Tuition Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0B0F14] text-white antialiased">
        {children}
      </body>
    </html>
  );
}