
export interface LoanRow {
  [key: string]: string | number;
  Found_In_File: string;
}

export interface AuditFilter {
  id: string;
  column: string;
  value: string;
}

export interface AuditResult {
  row: LoanRow;
  changes: Set<string>; // Keys that changed compared to previous instance of the same logical record
}

export interface FileData {
  name: string;
  data: any[];
}
