import { redirect } from "next/navigation";

import { getCurrentTeacher } from "@/lib/auth/session";

export async function requireTeacherPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");
  return teacher;
}
