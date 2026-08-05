export enum PaymentMethod {
  CASH = "CASH",
  UPI = "UPI",
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
}

export enum PaymentStatus {
  PAID = "PAID",
  PARTIAL = "PARTIAL",
  PENDING = "PENDING",
}

export enum BillingPeriod {
  MONTHLY = "MONTHLY",
  CLASSWISE = "CLASSWISE",
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  billingPeriod: BillingPeriod;
  notes: string;
}
