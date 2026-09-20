export enum FeeType {
  MONTHLY = "MONTHLY",
  CLASSWISE = "CLASSWISE",
}

export interface Student {
  id: string;
  name: string;
  subject: string;

  feeType: FeeType;
  fee: number;
  billingStartMonth?: string | null;

  active: boolean;

  color: string;
}
