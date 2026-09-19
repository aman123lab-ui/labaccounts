import re

file_path = 'src/app/incharge/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State Replacement
state_pattern = re.compile(
    r"// Modal State for Log Print Job \(Debit\)\s+const \[isDebitModalOpen, setIsDebitModalOpen\] = useState\(false\);\s+const \[targetStudentForDebit, setTargetStudentForDebit\] = useState<\(Student & \{ balance: number \}\) \| null>\(null\);\s+const \[globalStudentSearchQuery, setGlobalStudentSearchQuery\] = useState\(''\);\s+// Revenue Accounts State\s+const \[revenueAccounts, setRevenueAccounts\] = useState<Account\[\]>\(\[\]\);\s+const \[selectedRevenueAccountId, setSelectedRevenueAccountId\] = useState<string>\(''\);\s+const \[selectedBulkRevenueAccountId, setSelectedBulkRevenueAccountId\] = useState<string>\(''\);\s+// Multi-item print job state\s+const \[printItems, setPrintItems\] = useState<\{ id: string; type: PrintTypeOption; side: PrintSideOption; pages: number; discount: number \}\[\]>\(\[\]\);\s+const \[debitDesc, setDebitDesc\] = useState\(''\);\s+const \[paidImmediately, setPaidImmediately\] = useState<boolean>\(false\);\s+const \[submittingDebit, setSubmittingDebit\] = useState\(false\);\s+const \[debitError, setDebitError\] = useState<string \| null>\(null\);\s+// Modal State for Receive Cash \(Credit\)\s+const \[isCreditModalOpen, setIsCreditModalOpen\] = useState\(false\);\s+const \[targetStudentForCredit, setTargetStudentForCredit\] = useState<\(Student & \{ balance: number \}\) \| null>\(null\);\s+const \[creditAmount, setCreditAmount\] = useState<string>\(''\);\s+const \[creditDesc, setCreditDesc\] = useState\(''\);\s+const \[submittingCredit, setSubmittingCredit\] = useState\(false\);\s+const \[creditError, setCreditError\] = useState<string \| null>\(null\);",
    re.MULTILINE | re.DOTALL
)

state_replacement = '''// Unified Modal State for Transaction Entry (Debit / Credit)
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
  const [creditError, setCreditError] = useState<string | null>(null);'''

content = state_pattern.sub(state_replacement, content)

# 2. Handlers Replacement
handlers_pattern = re.compile(
    r"const openDebitModal =.*?setCreditError\(res\.error \|\| 'Failed to record cash payment\.'\);\s+\}\s+\} catch \(err: unknown\) \{\s+const msg = err instanceof Error \? err\.message : 'Credit post error\.';\s+setCreditError\(msg\);\s+\} finally \{\s+setSubmittingCredit\(false\);\s+\}\s+\};",
    re.MULTILINE | re.DOTALL
)

handlers_replacement = '''const openDebitModal = (student?: Student & { balance: number } | null) => {
    setTargetStudentForTransaction(student || null);
    setGlobalStudentSearchQuery('');
    setPrintItems([{ id: Date.now().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
    setPaidImmediately(false);
    setDebitDesc('');
    setDebitError(null);
    setTransactionMode('debit');
    setIsTransactionModalOpen(true);
  };

  const openGlobalDebitModal = () => {
    openDebitModal(null);
  };

  const addPrintItem = () => {
    setPrintItems(prev => [...prev, { id: Date.now().toString() + Math.random().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
  };
  
  const updatePrintItem = (id: string, field: string, value: any) => {
    setPrintItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const removePrintItem = (id: string) => {
    if (printItems.length > 1) {
      setPrintItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // Handle Log Print Job Submit
  const handleDebitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentForTransaction) return;

    setSubmittingDebit(true);
    setDebitError(null);

    try {
      const mappedItems = printItems.map(item => ({
        printType: item.type,
        side: item.side,
        numPages: item.pages,
        discount: item.discount
      }));
      const res = await postDebitEntries({
        studentIds: [targetStudentForTransaction.id],
        items: mappedItems,
        description: debitDesc,
        paidImmediately,
        useInchargeCashAccount: true,
        revenueAccountId: selectedRevenueAccountId,
      });

      if (res.success) {
        setIsTransactionModalOpen(false);
        await loadDashboardData();
      } else {
        setDebitError(res.error || 'Failed to post print job entry.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Debit post error.';
      setDebitError(msg);
    } finally {
      setSubmittingDebit(false);
    }
  };

  // Open Receive Cash Payment Modal
  const openCreditModal = (student?: Student & { balance: number } | null) => {
    const staffName = sessionUser?.userName || sessionUser?.inchargeEmail || 'Workforce Member';
    setTargetStudentForTransaction(student || null);
    setGlobalStudentSearchQuery('');
    setCreditAmount(student && student.balance > 0 ? student.balance.toFixed(2) : '');
    setCreditDesc(student ? Cash payment received from  — collected by  : Cash payment received — collected by );
    setCreditError(null);
    setTransactionMode('credit');
    setIsTransactionModalOpen(true);
  };

  const openGlobalCreditModal = () => {
    openCreditModal(null);
  };

  // Handle Receive Cash Submit
  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentForTransaction) return;

    const numAmt = Number(creditAmount);
    if (!numAmt || numAmt <= 0) {
      setCreditError('Please enter a valid cash amount greater than ₹0.00.');
      return;
    }

    setSubmittingCredit(true);
    setCreditError(null);

    const staffName = sessionUser?.userName || sessionUser?.inchargeEmail || 'Workforce Member';
    const finalDesc = creditDesc.includes('collected by')
      ? creditDesc
      : ${creditDesc} — collected by ;

    try {
      const res = await postCreditEntries({
        studentIds: [targetStudentForTransaction.id],
        amount: numAmt,
        description: finalDesc,
        useInchargeCashAccount: true,
      });

      if (res.success) {
        setIsTransactionModalOpen(false);
        await loadDashboardData();
      } else {
        setCreditError(res.error || 'Failed to record cash payment.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credit post error.';
      setCreditError(msg);
    } finally {
      setSubmittingCredit(false);
    }
  };'''

content = handlers_pattern.sub(handlers_replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done phase 1")
