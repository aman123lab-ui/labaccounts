const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. State Replacement
const stateOriginal =   // Modal State for Log Print Job (Debit)
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);
  const [globalStudentSearchQuery, setGlobalStudentSearchQuery] = useState('');

  // Revenue Accounts State
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedRevenueAccountId, setSelectedRevenueAccountId] = useState<string>('');
  const [selectedBulkRevenueAccountId, setSelectedBulkRevenueAccountId] = useState<string>('');
  
  // Multi-item print job state
  const [printItems, setPrintItems] = useState<{ id: string; type: PrintTypeOption; side: PrintSideOption; pages: number; discount: number }[]>([]);
  
  const [debitDesc, setDebitDesc] = useState('');
  const [paidImmediately, setPaidImmediately] = useState<boolean>(false);
  const [submittingDebit, setSubmittingDebit] = useState(false);
  const [debitError, setDebitError] = useState<string | null>(null);

  // Modal State for Receive Cash (Credit)
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [targetStudentForCredit, setTargetStudentForCredit] = useState<(Student & { balance: number }) | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditDesc, setCreditDesc] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);;

const stateReplacement =   // Unified Modal State for Transaction Entry (Debit / Credit)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'debit' | 'credit'>('debit');
  const [targetStudentForTransaction, setTargetStudentForTransaction] = useState<(Student & { balance: number }) | null>(null);
  const [globalStudentSearchQuery, setGlobalStudentSearchQuery] = useState('');

  // Revenue Accounts State
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [selectedRevenueAccountId, setSelectedRevenueAccountId] = useState<string>('');
  const [selectedBulkRevenueAccountId, setSelectedBulkRevenueAccountId] = useState<string>('');
  
  // Multi-item print job state
  const [printItems, setPrintItems] = useState<{ id: string; type: PrintTypeOption; side: PrintSideOption; pages: number; discount: number }[]>([]);
  
  const [debitDesc, setDebitDesc] = useState('');
  const [paidImmediately, setPaidImmediately] = useState<boolean>(false);
  const [submittingDebit, setSubmittingDebit] = useState(false);
  const [debitError, setDebitError] = useState<string | null>(null);

  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditDesc, setCreditDesc] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);;


// Replace CRLF to LF in content and search strings for matching
content = content.replace(/\r\n/g, '\n');
const stateOriginalNormalized = stateOriginal.replace(/\r\n/g, '\n');

if (content.includes(stateOriginalNormalized)) {
    content = content.replace(stateOriginalNormalized, stateReplacement);
    console.log("State replaced successfully.");
} else {
    console.log("State original string not found!");
}

fs.writeFileSync(filePath, content, 'utf-8');
