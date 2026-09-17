const fs = require('fs');
const path = 'd:\\\\anfaz\\\\coding\\\\Lab Accounting System\\\\src\\\\app\\\\incharge\\\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update State
const old_state = `  // Modal State for Log Print Job (Debit)
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);
  const [printType, setPrintType] = useState<PrintTypeOption>('bw');
  const [printSide, setPrintSide] = useState<PrintSideOption>('single');
  const [numPages, setNumPages] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
  const [debitDesc, setDebitDesc] = useState('');
  const [paidImmediately, setPaidImmediately] = useState<boolean>(false);`;

const new_state = `  // Modal State for Log Print Job (Debit)
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);
  
  // Multi-item print job state
  const [printItems, setPrintItems] = useState<{ id: string; type: PrintTypeOption; side: PrintSideOption; pages: number; discount: number }[]>([]);
  
  const [debitDesc, setDebitDesc] = useState('');
  const [paidImmediately, setPaidImmediately] = useState<boolean>(false);`;

if(content.includes(old_state)) { 
    content = content.replace(old_state, new_state); 
    console.log('State replaced');
}
else { console.log('State not found'); }

// 2. Update computedPrintCalc and openDebitModal
const old_funcs = `  // Calculated print price for modal
  const computedPrintCalc = useMemo(() => {
    return calculatePrintAmount(printType, printSide, numPages, discount);
  }, [printType, printSide, numPages, discount]);

  // Open Log Print Job Modal
  const openDebitModal = (student: Student & { balance: number }) => {
    setTargetStudentForDebit(student);
    setPrintType('bw');
    setPrintSide('single');
    setNumPages(1);
    setDiscount(0);
    setPaidImmediately(false);
    setDebitDesc(\`Print Job (B/W, single, 1 pages)\`);
    setDebitError(null);
    setIsDebitModalOpen(true);
  };`;

const new_funcs = `  // Calculated multi-item print total
  const computedPrintCalc = useMemo(() => {
    let totalAmount = 0;
    printItems.forEach(item => {
      totalAmount += calculatePrintAmount(item.type, item.side, item.pages, item.discount).totalAmount;
    });
    return { totalAmount };
  }, [printItems]);

  // Open Log Print Job Modal
  const openDebitModal = (student: Student & { balance: number }) => {
    setTargetStudentForDebit(student);
    setPrintItems([{ id: Date.now().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
    setPaidImmediately(false);
    setDebitDesc('');
    setDebitError(null);
    setIsDebitModalOpen(true);
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
  };`;

if(content.includes(old_funcs)) { 
    content = content.replace(old_funcs, new_funcs); 
    console.log('Funcs replaced');
}
else { console.log('Funcs not found'); }

// 3. Update handleDebitSubmit
const old_submit = `    try {
      const res = await postDebitEntries({
        studentIds: [targetStudentForDebit.id],
        printType,
        side: printSide,
        numPages,
        description: debitDesc,
        discount,
        paidImmediately,
        useInchargeCashAccount: true,
      });`;

const new_submit = `    try {
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
      });`;

if(content.includes(old_submit)) { 
    content = content.replace(old_submit, new_submit); 
    console.log('Submit replaced');
}
else { console.log('Submit not found'); }

fs.writeFileSync(path, content, 'utf8');
console.log('Success');
