const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes('import { getStudentDetailsAndBalance }')) {
  const importAnchor = `import { sortBatches } from '@/services/batchService';`;
  const importAdd = `import { sortBatches } from '@/services/batchService';
import { getStudentDetailsAndBalance } from '@/services/studentService';`;
  content = content.replace(importAnchor, importAdd);
}

// 2. Add State and useEffect
const stateAnchor = `const [statementStudent, setStatementStudent] = useState<(Student & { balance: number }) | null>(null);`;
const stateAdd = `const [statementStudent, setStatementStudent] = useState<(Student & { balance: number }) | null>(null);
  const [statementTransactions, setStatementTransactions] = useState<any[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    if (statementStudent) {
      setLoadingStatement(true);
      getStudentDetailsAndBalance({ studentId: statementStudent.id })
        .then(res => {
          if (res && res.transactions) {
            setStatementTransactions(res.transactions);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingStatement(false));
    } else {
      setStatementTransactions([]);
    }
  }, [statementStudent]);`;
content = content.replace(stateAnchor, stateAdd);

// 3. Add Ledger Table to Modal
const modalAnchor = `                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-2">`;
const modalAdd = `                  )}
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                  {loadingStatement ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-semibold animate-pulse">Loading ledger...</div>
                  ) : statementTransactions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-semibold">No transaction history.</div>
                  ) : (
                    <table className="w-full text-left text-[10px] sm:text-xs">
                      <thead className="bg-slate-100 sticky top-0 shadow-sm">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold text-slate-600 border-b border-slate-200">Date</th>
                          <th className="px-2 py-1.5 font-semibold text-slate-600 border-b border-slate-200">Details</th>
                          <th className="px-2 py-1.5 font-semibold text-slate-600 text-right border-b border-slate-200">Debit</th>
                          <th className="px-2 py-1.5 font-semibold text-slate-600 text-right border-b border-slate-200">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {statementTransactions.map((t, i) => (
                          <tr key={i} className="hover:bg-white transition-colors">
                            <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                            <td className="px-2 py-2 text-slate-700 truncate max-w-[120px]" title={t.description}>{t.description}</td>
                            <td className="px-2 py-2 text-right text-red-600 font-mono">{t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
                            <td className="px-2 py-2 text-right text-emerald-600 font-mono">{t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-2">`;
content = content.replace(modalAnchor, modalAdd);

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete.');
