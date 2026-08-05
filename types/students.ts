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

  active: boolean;

  color: string;
}
