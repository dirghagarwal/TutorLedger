"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  provisionTeacherAccountAction,
  switchTeacherAccountAction,
  updatePasswordAction,
} from "@/app/actions/auth";

interface TeacherSummary {
  id: string;
  name: string;
  email: string | null;
}

interface TeacherAccountManagerProps {
  currentTeacher: TeacherSummary;
  availableTeachers: TeacherSummary[];
}

export default function TeacherAccountManager({
  currentTeacher,
  availableTeachers,
}: TeacherAccountManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Password rotation state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Switch teacher state
  const [switchEmail, setSwitchEmail] = useState(
    availableTeachers.find((t) => t.id !== currentTeacher.id)?.email ?? ""
  );
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchMsg, setSwitchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Provision teacher state
  const [provName, setProvName] = useState("");
  const [provEmail, setProvEmail] = useState("");
  const [provPassword, setProvPassword] = useState("");
  const [provMsg, setProvMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("currentPassword", currentPassword);
      fd.append("newPassword", newPassword);
      const res = await updatePasswordAction(fd);
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Password updated successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({ type: "error", text: res.error });
      }
    });
  };

  const handleSwitchAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchEmail || !switchPassword) {
      setSwitchMsg({ type: "error", text: "Email and password are required." });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", switchEmail);
      fd.append("password", switchPassword);
      const res = await switchTeacherAccountAction(fd);
      if (res.ok) {
        setSwitchMsg({ type: "success", text: "Account switched. Reloading..." });
        router.push("/");
        router.refresh();
      } else {
        setSwitchMsg({ type: "error", text: res.error });
      }
    });
  };

  const handleProvisionTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName || !provEmail || !provPassword) {
      setProvMsg({ type: "error", text: "All fields are required." });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", provName);
      fd.append("email", provEmail);
      fd.append("password", provPassword);
      const res = await provisionTeacherAccountAction(fd);
      if (res.ok) {
        setProvMsg({ type: "success", text: `Teacher "${provName}" provisioned successfully.` });
        setProvName("");
        setProvEmail("");
        setProvPassword("");
        router.refresh();
      } else {
        setProvMsg({ type: "error", text: res.error });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Current Profile Card */}
      <div className="rounded-2xl border border-border bg-background/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Active Profile
            </span>
            <p className="mt-2 text-base font-semibold">{currentTeacher.name}</p>
            <p className="text-xs text-muted-foreground">{currentTeacher.email ?? "Email not set"}</p>
          </div>
        </div>
      </div>

      {/* Password Rotation */}
      <div className="rounded-2xl border border-border bg-background/30 p-5">
        <h3 className="text-sm font-semibold">Change Password</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Rotate your password securely. Minimum 8 characters.
        </p>

        <form onSubmit={handleUpdatePassword} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {passwordMsg && (
            <p className={`text-xs ${passwordMsg.type === "success" ? "text-emerald-400" : "text-destructive"}`}>
              {passwordMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !currentPassword || !newPassword}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Account Switching (e.g. Dirgh <-> Rajshree) */}
      <div className="rounded-2xl border border-border bg-background/30 p-5">
        <h3 className="text-sm font-semibold">Switch Teacher Profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Re-authenticate securely to switch to another isolated teacher account.
        </p>

        <form onSubmit={handleSwitchAccount} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Teacher Account</label>
            <select
              value={switchEmail}
              onChange={(e) => setSwitchEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.email ?? ""}>
                  {t.name} ({t.email ?? "No email"}) {t.id === currentTeacher.id ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <input
              type="password"
              value={switchPassword}
              onChange={(e) => setSwitchPassword(e.target.value)}
              placeholder="Enter password to authenticate"
              required
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {switchMsg && (
            <p className={`text-xs ${switchMsg.type === "success" ? "text-emerald-400" : "text-destructive"}`}>
              {switchMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !switchEmail || !switchPassword}
            className="h-9 rounded-xl border border-primary bg-primary/10 px-4 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {pending ? "Authenticating..." : "Switch Profile"}
          </button>
        </form>
      </div>

      {/* Provision Teacher Account */}
      <div className="rounded-2xl border border-border bg-background/30 p-5">
        <h3 className="text-sm font-semibold">Provision New Teacher Account</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Create an independent workspace for a second teacher (e.g. Rajshree).
        </p>

        <form onSubmit={handleProvisionTeacher} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Teacher Name</label>
              <input
                type="text"
                placeholder="e.g. Rajshree"
                value={provName}
                onChange={(e) => setProvName(e.target.value)}
                required
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email Address</label>
              <input
                type="email"
                placeholder="rajshree@example.com"
                value={provEmail}
                onChange={(e) => setProvEmail(e.target.value)}
                required
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Initial Password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={provPassword}
              onChange={(e) => setProvPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {provMsg && (
            <p className={`text-xs ${provMsg.type === "success" ? "text-emerald-400" : "text-destructive"}`}>
              {provMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !provName || !provEmail || !provPassword}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Provisioning..." : "Create Teacher Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
