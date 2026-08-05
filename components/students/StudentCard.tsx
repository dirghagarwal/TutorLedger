"use client";

import { Archive, CalendarDays, Ellipsis, IndianRupee, Pencil, School2, Trash2, WalletCards } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FeeType, type Student } from "@/types/students";

interface StudentCardProps {
  student: Student;
  attendedClasses: number;
  outstandingBalance: number;
  weeklySchedule: string;
  onArchive: (student: Student) => void;
  onDelete: (student: Student) => void;
  onEdit: (student: Student) => void;
}

const feeTypeLabels: Record<FeeType, string> = {
  [FeeType.CLASSWISE]: "Class-wise",
  [FeeType.MONTHLY]: "Monthly",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "&")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function StudentCard({
  attendedClasses,
  outstandingBalance,
  student,
  weeklySchedule,
  onArchive,
  onDelete,
  onEdit,
}: Readonly<StudentCardProps>) {
  const router = useRouter();
  const profilePath = `/students/${student.id}`;
  const pendingFeesLabel =
    outstandingBalance > 0
      ? currencyFormatter.format(outstandingBalance)
      : "No pending fees";

  const openProfile = () => router.push(profilePath);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProfile();
    }
  };
  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openProfile();
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Open ${student.name}'s profile`}
      initial={{ opacity: 0, y: 8 }}
      role="link"
      tabIndex={0}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={openProfile}
      onKeyDown={handleKeyDown}
    >
      <Card className="h-full cursor-pointer border-border-strong bg-surface text-foreground shadow-card transition-colors duration-200 hover:border-primary/60 hover:shadow-floating">
        <CardHeader className="gap-4 border-b border-border/50 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-foreground ring-4 ring-border/30"
                style={{ backgroundColor: student.color }}
              >
                {getInitials(student.name)}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg font-semibold text-foreground">
                  {student.name}
                </CardTitle>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {student.subject}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  student.active
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-border bg-muted text-muted-foreground"
                }
                variant="outline"
              >
                {student.active ? "Active" : "Archived"}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button aria-label={`Actions for ${student.name}`} size="icon-sm" variant="ghost" />}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Ellipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onEdit(student)}><Pencil /> Edit</DropdownMenuItem>
                  {student.active && <DropdownMenuItem onClick={() => onArchive(student)}><Archive /> Archive</DropdownMenuItem>}
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(student)}><Trash2 /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 pt-4">
          <div className="grid gap-3 rounded-xl border border-border/50 bg-muted p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <School2 className="size-4 text-primary" />
                <span>Fee model</span>
              </div>
              <span className="font-medium text-foreground">
                {feeTypeLabels[student.feeType]}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IndianRupee className="size-4 text-primary" />
                <span>Fee amount</span>
              </div>
              <span className="font-medium text-foreground">
                {currencyFormatter.format(student.fee)}
              </span>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-surface-subtle px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>Weekly schedule</span>
            </div>
            <span className="max-w-[60%] text-right text-sm font-medium text-secondary-foreground">
              {weeklySchedule}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-warning/10 bg-warning/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WalletCards className="size-4 text-warning" />
              <span>Pending fees</span>
            </div>
            <span
              className={`text-right text-sm font-semibold ${outstandingBalance > 0 ? "text-warning" : "text-success"}`}
            >
              {pendingFeesLabel}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-sm text-muted-foreground">Total classes</span>
            <span className="text-sm font-semibold text-foreground">
              {attendedClasses}
            </span>
          </div>

          <Button
            className="mt-1 w-full border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
            size="sm"
            type="button"
            variant="outline"
            onClick={handleButtonClick}
          >
            View profile
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
