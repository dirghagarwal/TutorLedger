import { PrismaClient } from "@prisma/client";

import { attendance } from "@/lib/data/attendance";
import { payments } from "@/lib/data/payments";
import { schedules } from "@/lib/data/schedules";
import { sessions } from "@/lib/data/sessions";
import { students } from "@/lib/data/students";

const prisma = new PrismaClient();

async function main() {
  const teacherId = "legacy-teacher";
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.student.deleteMany();

  await prisma.student.createMany({ data: students.map((row) => ({ ...row, teacherId })) });
  await prisma.schedule.createMany({ data: schedules.map((row) => ({ ...row, teacherId })) });
  await prisma.session.createMany({ data: sessions.map((row) => ({ ...row, teacherId })) });
  await prisma.attendance.createMany({ data: attendance.map((row) => ({ ...row, teacherId })) });
  await prisma.payment.createMany({ data: payments.map((row) => ({ ...row, teacherId })) });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
