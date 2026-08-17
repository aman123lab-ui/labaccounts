export type AccountType = 'asset' | 'liability' | 'revenue' | 'expense' | 'equity';
export type StudentStatus = 'active' | 'archived';
export type PrintType = 'bw' | 'color';
export type PrintSide = 'single' | 'double';

export interface Batch {
  id: string;
  name: string;
  category: string;
  sort_order: number;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  password_hash: string;
  batch_id: string;
  status: StudentStatus;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  is_student_account: boolean;
  student_id?: string | null;
  created_at: string;
}

export interface FinancialYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  closed_at?: string | null;
  closing_entry_id?: string | null;
  created_new_fy_id?: string | null;
  rollover_snapshot?: unknown | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  financial_year_id?: string | null;
  is_closing_entry?: boolean;
  created_by?: string | null;
  created_at: string;
  voided_at?: string | null;
  voided_by?: string | null;
}

export interface JournalEntryAuditLog {
  id: string;
  journal_entry_id: string;
  action: 'edited' | 'deleted';
  changed_by: string;
  changed_at: string;
  before_snapshot: unknown;
  after_snapshot?: unknown | null;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
}

export interface PrintJob {
  id: string;
  journal_entry_id?: string | null;
  student_id: string;
  print_type: PrintType;
  side: PrintSide;
  num_pages: number;
  description?: string | null;
  discount: number;
  amount: number;
  created_at: string;
}

// Input type for posting journal entries
export interface PostJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface PostJournalEntryInput {
  description: string;
  lines: PostJournalLineInput[];
  date?: string;
  financialYearId?: string;
  createdBy?: string;
}

// Database schema shape for Supabase client typing
export type Database = {
  public: {
    Tables: {
      batches: {
        Row: Batch;
        Insert: Omit<Batch, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Batch, 'id'>>;
      };
      students: {
        Row: Student;
        Insert: Omit<Student, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Student, 'id'>>;
      };
      accounts: {
        Row: Account;
        Insert: Omit<Account, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Account, 'id'>>;
      };
      financial_years: {
        Row: FinancialYear;
        Insert: Omit<FinancialYear, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<FinancialYear, 'id'>>;
      };
      journal_entries: {
        Row: JournalEntry;
        Insert: Omit<JournalEntry, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<JournalEntry, 'id'>>;
      };
      journal_entry_lines: {
        Row: JournalEntryLine;
        Insert: Omit<JournalEntryLine, 'id'> & { id?: string };
        Update: Partial<Omit<JournalEntryLine, 'id'>>;
      };
      print_jobs: {
        Row: PrintJob;
        Insert: Omit<PrintJob, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<PrintJob, 'id'>>;
      };
    };
    Functions: {
      post_journal_entry: {
        Args: {
          p_description: string;
          p_lines: { account_id: string; debit_amount: number; credit_amount: number }[];
          p_date?: string;
          p_financial_year_id?: string;
          p_created_by?: string;
        };
        Returns: string;
      };
    };
  };
};
