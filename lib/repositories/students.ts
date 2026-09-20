import { tenantPrisma } from "@/lib/db/tenant-prisma";
import { FeeType, type Student } from "@/types/students";

export type StudentInput = Omit<Student, "id">;

function toStudent(record: Awaited<ReturnType<typeof tenantPrisma.student.findMany>>[number]): Student {
  return { ...record, feeType: record.feeType as FeeType };
}

export async function findStudents(): Promise<Student[]> {
  const records = await tenantPrisma.student.findMany({ orderBy: { id: "asc" } });
  return records.map(toStudent);
}

export async function findStudentById(id: string): Promise<Student | null> {
  const record = await tenantPrisma.student.findUnique({ where: { id } });
  return record ? toStudent(record) : null;
}

export async function findStudentByName(name: string): Promise<Student | null> {
  const records = await tenantPrisma.student.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
  });
  return records.length > 0 ? toStudent(records[0]) : null;
}

export async function createStudent(input: Student): Promise<Student> {
    const record = await tenantPrisma.student.create({ data: input as never });
  return toStudent(record);
}

export async function updateStudent(id: string, input: StudentInput): Promise<Student> {
  const record = await tenantPrisma.student.update({ where: { id }, data: input });
  return toStudent(record);
}

export async function archiveStudent(id: string): Promise<Student> {
  const record = await tenantPrisma.student.update({ where: { id }, data: { active: false } });
  return toStudent(record);
}

export async function deleteStudent(id: string): Promise<void> {
  await tenantPrisma.student.delete({ where: { id } });
}
