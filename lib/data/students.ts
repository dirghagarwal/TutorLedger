import { FeeType, Student } from "@/types/students";

export const students: Student[] = [
  {
    id: "1",
    name: "Aahan & Aalya",
    subject: "Computer",
    feeType: FeeType.MONTHLY,
    fee: 2500,
    active: true,
    color: "#2563EB",
  },
  {
    id: "2",
    name: "Tanay",
    subject: "Computer",
    feeType: FeeType.CLASSWISE,
    fee: 600,
    active: true,
    color: "#7C3AED",
  },
  {
    id: "3",
    name: "Ritisha",
    subject: "Economics",
    feeType: FeeType.MONTHLY,
    fee: 2500,
    active: true,
    color: "#DB2777",
  },
  {
    id: "4",
    name: "Viraj & Vivaan",
    subject: "Computer",
    feeType: FeeType.MONTHLY,
    fee: 2500,
    active: true,
    color: "#EA580C",
  },
  {
    id: "5",
    name: "Rishabh",
    subject: "Computer",
    feeType: FeeType.CLASSWISE,
    fee: 600,
    active: true,
    color: "#059669",
  },
];
