import { Account, AccountType, JournalEntry, JournalEntryLine, PostJournalLineInput } from '@/types/database.types';

/**
 * Validates whether a list of journal entry lines balances (Total Debits === Total Credits)
 * and whether each line is properly formed (exactly one of debit or credit is > 0).
 */
export function validateJournalEntryLines(lines: PostJournalLineInput[]): {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  error?: string;
} {
  if (!lines || lines.length < 2) {
    return {
      isValid: false,
      totalDebit: 0,
      totalCredit: 0,
      error: 'A journal entry must contain at least two entry lines (double-entry requirement).',
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);

    if (debit < 0 || credit < 0) {
      return {
        isValid: false,
        totalDebit: 0,
        totalCredit: 0,
        error: `Line ${i + 1} contains negative amounts. Debits and credits must be non-negative.`,
      };
    }

    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return {
        isValid: false,
        totalDebit: 0,
        totalCredit: 0,
        error: `Line ${i + 1} must have exactly one positive amount (either debit or credit > 0).`,
      };
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  // Round to 2 decimal places to prevent float precision discrepancies
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;

  if (roundedDebit !== roundedCredit) {
    return {
      isValid: false,
      totalDebit: roundedDebit,
      totalCredit: roundedCredit,
      error: `Unbalanced journal entry rejected: Total Debits ($${roundedDebit.toFixed(
        2
      )}) must equal Total Credits ($${roundedCredit.toFixed(2)}).`,
    };
  }

  return {
    isValid: true,
    totalDebit: roundedDebit,
    totalCredit: roundedCredit,
  };
}

/**
 * Computes the correct balance for an account from its ledger lines based on its Account Type.
 * 
 * Account Normal Balances:
 * - Asset: Debit (Balance = Total Debits - Total Credits)
 * - Expense: Debit (Balance = Total Debits - Total Credits)
 * - Liability: Credit (Balance = Total Credits - Total Debits)
 * - Equity (Fund Balance / Net Assets): Credit (Balance = Total Credits - Total Debits)
 * - Revenue (Service Income): Credit (Balance = Total Credits - Total Debits)
 */
export function calculateAccountBalanceFromLines(
  accountType: AccountType,
  lines: Pick<JournalEntryLine, 'account_id' | 'debit_amount' | 'credit_amount'>[],
  accountId: string
): number {
  const accountLines = lines.filter((l) => l.account_id === accountId);
  
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of accountLines) {
    totalDebit += Number(line.debit_amount || 0);
    totalCredit += Number(line.credit_amount || 0);
  }

  // Assets and Expenses are Debit-normal
  if (accountType === 'asset' || accountType === 'expense') {
    return Math.round((totalDebit - totalCredit) * 100) / 100;
  }

  // Liabilities, Equity (Fund Balance), and Revenue are Credit-normal
  return Math.round((totalCredit - totalDebit) * 100) / 100;
}

/**
 * In-Memory Accounting Store for testing, validation, and zero-dependency local ledger operations.
 */
export class AccountingEngine {
  private accounts: Map<string, Account> = new Map();
  private journalEntries: JournalEntry[] = [];
  private journalEntryLines: JournalEntryLine[] = [];

  constructor(initialAccounts: Account[] = []) {
    for (const acc of initialAccounts) {
      this.accounts.set(acc.id, acc);
    }
  }

  public registerAccount(account: Account) {
    this.accounts.set(account.id, account);
  }

  public getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  /**
   * Atomically posts a journal entry to the ledger.
   * Throws an error if debits != credits or if an account is missing.
   */
  public postJournalEntry(
    lines: PostJournalLineInput[],
    description: string,
    meta?: { date?: string; financialYearId?: string; createdBy?: string }
  ): { journalEntry: JournalEntry; lines: JournalEntryLine[] } {
    // 1. Double-Entry Balance Check
    const validation = validateJournalEntryLines(lines);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid journal entry.');
    }

    // 2. Validate accounts existence
    for (const line of lines) {
      if (!this.accounts.has(line.accountId)) {
        throw new Error(`Account ID '${line.accountId}' does not exist in Chart of Accounts.`);
      }
    }

    const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = meta?.date || new Date().toISOString();

    const journalEntry: JournalEntry = {
      id: entryId,
      date: now,
      description,
      financial_year_id: meta?.financialYearId || null,
      created_by: meta?.createdBy || null,
      created_at: now,
    };

    const insertedLines: JournalEntryLine[] = lines.map((line, index) => ({
      id: `line-${entryId}-${index + 1}`,
      journal_entry_id: entryId,
      account_id: line.accountId,
      debit_amount: Math.round(Number(line.debit || 0) * 100) / 100,
      credit_amount: Math.round(Number(line.credit || 0) * 100) / 100,
    }));

    // Atomic persistence (in-memory)
    this.journalEntries.push(journalEntry);
    this.journalEntryLines.push(...insertedLines);

    return { journalEntry, lines: insertedLines };
  }

  /**
   * Computes balance from journal entry lines (never stored running totals).
   */
  public getAccountBalance(accountId: string): number {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account '${accountId}' not found.`);
    }

    return calculateAccountBalanceFromLines(account.type, this.journalEntryLines, accountId);
  }

  /**
   * Fund Accounting helper: Computes total Net Surplus or Deficit
   * Surplus/Deficit = Total Revenue - Total Expense
   */
  public getSurplusDeficit(): number {
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const account of this.accounts.values()) {
      if (account.type === 'revenue') {
        totalRevenue += this.getAccountBalance(account.id);
      } else if (account.type === 'expense') {
        totalExpense += this.getAccountBalance(account.id);
      }
    }

    return Math.round((totalRevenue - totalExpense) * 100) / 100;
  }

  public getAllEntries() {
    return {
      entries: [...this.journalEntries],
      lines: [...this.journalEntryLines],
    };
  }
}
