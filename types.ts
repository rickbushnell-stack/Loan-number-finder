
export interface LoanRow {
  [key: string]: string | number;
  Found_In_File: string;
}

export interface AuditResult {
  row: LoanRow;
  changes: Set<string>; // Keys that changed compared to previous instance
}

export interface FileData {
  name: string;
  data: any[];
}
