const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. STATE REPLACEMENT
const stateOriginal = `  // Modal State for Log Print Job (Debit)
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
  const [creditError, setCreditError] = useState<string | null>(null);`;

const stateReplacement = `  // Unified Modal State for Transaction Entry (Debit / Credit)
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
  const [creditError, setCreditError] = useState<string | null>(null);`;

content = content.replace(stateOriginal, stateReplacement);

// 2. HANDLERS REPLACEMENT
const handlersOriginal = `  const openDebitModal = (student?: Student & { balance: number } | null) => {
    setTargetStudentForDebit(student || null);
    setGlobalStudentSearchQuery('');
    setPrintItems([{ id: Date.now().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
    setPaidImmediately(false);
    setDebitDesc('');
    setDebitError(null);
    setIsDebitModalOpen(true);
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
    if (!targetStudentForDebit) return;

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
        studentIds: [targetStudentForDebit.id],
        items: mappedItems,
        description: debitDesc,
        paidImmediately,
        useInchargeCashAccount: true,
        revenueAccountId: selectedRevenueAccountId,
      });

      if (res.success) {
        setIsDebitModalOpen(false);
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
    setTargetStudentForCredit(student || null);
    setGlobalStudentSearchQuery('');
    setCreditAmount(student && student.balance > 0 ? student.balance.toFixed(2) : '');
    setCreditDesc(student ? \`Cash payment received from \${student.name} — collected by \${staffName}\` : \`Cash payment received — collected by \${staffName}\`);
    setCreditError(null);
    setIsCreditModalOpen(true);
  };

  const openGlobalCreditModal = () => {
    openCreditModal(null);
  };

  // Handle Receive Cash Submit
  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentForCredit) return;

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
      : \`\${creditDesc} — collected by \${staffName}\`;

    try {
      const res = await postCreditEntries({
        studentIds: [targetStudentForCredit.id],
        amount: numAmt,
        description: finalDesc,
        useInchargeCashAccount: true,
      });

      if (res.success) {
        setIsCreditModalOpen(false);
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
  };`;

const handlersReplacement = `  const openDebitModal = (student?: Student & { balance: number } | null) => {
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
    setCreditDesc(student ? \`Cash payment received from \${student.name} — collected by \${staffName}\` : \`Cash payment received — collected by \${staffName}\`);
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
      : \`\${creditDesc} — collected by \${staffName}\`;

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
  };`;

content = content.replace(handlersOriginal, handlersReplacement);

// 3. JSX BLOCK REPLACEMENT
const jsxReplacement = `        {/* UNIFIED MODAL: DEBIT (Print Job) OR CREDIT (Cash Received) */}
        {isTransactionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono block">
                    Workforce Action
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">Transaction Entry</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="text-slate-500 hover:text-slate-900 bg-slate-100 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* TWO-MODE TOGGLE */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setTransactionMode('debit')}
                  className={\`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all \${
                    transactionMode === 'debit' 
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }\`}
                >
                  🔴 DEBIT (Print Job)
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionMode('credit')}
                  className={\`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all \${
                    transactionMode === 'credit' 
                      ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }\`}
                >
                  🟢 CREDIT (Cash Received)
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                {targetStudentForTransaction ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Target Student</span>
                        <span className="text-slate-900 font-bold text-sm">{targetStudentForTransaction.name}</span>
                        <span className="text-slate-500 font-mono block text-[11px] mt-0.5">
                          Current Balance: <span className="font-sans font-bold mr-0.5">₹</span><span className={\`font-mono font-bold \${targetStudentForTransaction.balance < 0 ? 'text-red-600' : targetStudentForTransaction.balance > 0 ? 'text-blue-600' : 'text-slate-500'}\`}>{Math.abs(targetStudentForTransaction.balance).toFixed(2)}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTargetStudentForTransaction(null)}
                        className={\`text-[10px] font-bold px-2 py-1 rounded-md transition-colors \${
                          transactionMode === 'debit' 
                            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' 
                            : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        }\`}
                      >
                        Change
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                      Search & Select Student
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search name, batch, phone..."
                        value={globalStudentSearchQuery}
                        onChange={(e) => setGlobalStudentSearchQuery(e.target.value)}
                        autoFocus
                        className={\`w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 text-xs text-slate-900 placeholder-slate-500 focus:outline-none font-mono h-9 \${
                          transactionMode === 'debit' ? 'focus:border-indigo-500' : 'focus:border-emerald-500'
                        }\`}
                      />
                      <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      
                      {globalStudentSearchQuery.trim() !== '' && (
                        <div className="mt-1.5 z-30 bg-white border border-slate-300 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-200 shadow-xl">
                          {students
                            .filter(
                              (s) =>
                                (transactionMode === 'debit' || s.status === 'active') &&
                                (s.name.toLowerCase().includes(globalStudentSearchQuery.toLowerCase().trim()) ||
                                (s.batch_name || '').toLowerCase().includes(globalStudentSearchQuery.toLowerCase().trim()) ||
                                (s.phone && s.phone.includes(globalStudentSearchQuery.trim())))
                            )
                            .slice(0, transactionMode === 'debit' ? 10 : undefined)
                            .map((s) => (
                              <button
                                type="button"
                                key={s.id}
                                onClick={() => {
                                  setTargetStudentForTransaction(s);
                                  setGlobalStudentSearchQuery('');
                                  if (transactionMode === 'credit' && s.balance > 0) {
                                    setCreditAmount(s.balance.toFixed(2));
                                  }
                                }}
                                className={\`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors \${
                                  transactionMode === 'debit' ? 'hover:bg-slate-50' : 'hover:bg-emerald-50'
                                }\`}
                              >
                                <div>
                                  <span className="font-semibold text-slate-900">{s.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono ml-2">({s.batch_name || 'General'})</span>
                                </div>
                                <span className={\`text-[10px] font-mono font-bold whitespace-nowrap \${
                                  transactionMode === 'debit' ? 'text-indigo-700' : 
                                  s.balance < 0 ? 'text-red-600' : s.balance > 0 ? 'text-blue-600' : 'text-slate-500'
                                }\`}>
                                  ₹{Math.abs(s.balance).toFixed(2)}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(transactionMode === 'debit' && debitError) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {debitError}
                </div>
              )}
              {(transactionMode === 'credit' && creditError) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {creditError}
                </div>
              )}

              {/* FORMS */}
              {targetStudentForTransaction && (
                <>
                  {/* DEBIT FORM */}
                  {transactionMode === 'debit' && (
                    <form onSubmit={handleDebitSubmit} className="space-y-4">
                      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                        {printItems.map((item, index) => (
                          <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3">
                            <div className="absolute -top-2 -left-2 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[10px] font-bold border border-indigo-200">
                              {index + 1}
                            </div>
                            {printItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePrintItem(item.id)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-[10px] hover:bg-red-200 border border-red-200 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3 mt-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Print Type</label>
                                <select
                                  value={item.type}
                                  onChange={(e) => updatePrintItem(item.id, 'type', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="bw">B/W (₹1/page)</option>
                                  <option value="color">Color (₹5/page)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Side</label>
                                <select
                                  value={item.side}
                                  onChange={(e) => updatePrintItem(item.id, 'side', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="single">Single Sided</option>
                                  <option value="double">Double Sided</option>
                                </select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Num Pages</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.pages}
                                  onChange={(e) => updatePrintItem(item.id, 'pages', Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Discount (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.discount}
                                  onChange={(e) => updatePrintItem(item.id, 'discount', Math.max(0, parseFloat(e.target.value) || 0))}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={addPrintItem}
                          className="w-full border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 bg-white font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Add Another Print Item</span>
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Overall Entry Description (Optional)
                        </label>
                        <input
                          type="text"
                          value={debitDesc}
                          onChange={(e) => setDebitDesc(e.target.value)}
                          placeholder="e.g. Project report and charts"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Revenue Account
                        </label>
                        <select
                          value={selectedRevenueAccountId}
                          onChange={(e) => setSelectedRevenueAccountId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        >
                          {revenueAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Paid in Cash Immediately Toggle Card */}
                      <div
                        onClick={() => setPaidImmediately(!paidImmediately)}
                        className={\`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 \${
                          paidImmediately
                            ? 'bg-emerald-50 border-emerald-300 shadow-lg shadow-emerald-950/30'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-200'
                        }\`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={\`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 \${
                              paidImmediately
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/50'
                                : 'bg-white border-slate-300 text-transparent'
                            }\`}
                          >
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <span className={\`text-xs font-bold transition-colors \${paidImmediately ? 'text-emerald-800' : 'text-slate-600'}\`}>
                              Paid in Cash Immediately
                            </span>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              {paidImmediately
                                ? 'Posts to Cash in Hand (Workforce). Balance unaffected.'
                                : 'Posts as Accounts Receivable due from student.'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={\`text-[10px] font-bold px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider shrink-0 transition-colors \${
                            paidImmediately
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-900 text-slate-500 border border-slate-200'
                          }\`}
                        >
                          {paidImmediately ? 'Cash Sale' : 'On Credit'}
                        </span>
                      </div>

                      {/* Computed Total Amount Display */}
                      <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-700">Total Debit Amount:</span>
                        <span className="text-base font-black text-slate-900 font-mono">
                          <span className="font-sans font-bold mr-0.5">₹</span><span className="font-mono font-bold">{computedPrintCalc.totalAmount.toFixed(2)}</span>
                        </span>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsTransactionModalOpen(false)}
                          disabled={submittingDebit}
                          className="bg-slate-100 hover:bg-slate-700 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingDebit}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg"
                        >
                          {submittingDebit ? 'Posting...' : 'Post Debit Entry'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* CREDIT FORM */}
                  {transactionMode === 'credit' && (
                    <form onSubmit={handleCreditSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Cash Amount Received (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-emerald-700 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Description / Note
                        </label>
                        <input
                          type="text"
                          value={creditDesc}
                          onChange={(e) => setCreditDesc(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsTransactionModalOpen(false)}
                          disabled={submittingCredit}
                          className="bg-slate-100 hover:bg-slate-700 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingCredit}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg"
                        >
                          {submittingCredit ? 'Processing...' : 'Record Cash Received'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
`;

const startMarker = '{/* MODAL 1: LOG PRINT JOB (DEBIT ENTRY) */}';
const endMarker = '{/* MODAL 3: HAND OVER CASH TO ADMIN */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + jsxReplacement + '\\n\\n        ' + content.substring(endIndex);
    content = newContent;
} else {
    console.log('Markers not found.');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully completed all replacements.');
