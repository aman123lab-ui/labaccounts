const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
const importAnchor = `import AddStudentModal from '@/components/AddStudentModal';`;
const importAdd = `import AddStudentModal from '@/components/AddStudentModal';
import EditStudentModal from '@/components/EditStudentModal';`;
content = content.replace(importAnchor, importAdd);

// 2. Add State
const stateAnchor = `const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);`;
const stateAdd = `const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);`;
content = content.replace(stateAnchor, stateAdd);

// 3. Add Edit Button to Quick Actions
const buttonAnchor = `{/* Log Print Job Button */}`;
const buttonAdd = `{/* Edit Student Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingStudent(stud); }}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm flex items-center gap-1 border border-slate-200"
                                    title="Edit student details"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    <span>Edit</span>
                                  </button>

                                  {/* Log Print Job Button */}`;
content = content.replace(buttonAnchor, buttonAdd);

// 4. Add Edit Modal Render
const modalAnchor = `<AddStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          onStudentAdded={() => {
            setIsAddStudentOpen(false);
            loadDashboardData();
          }}
        />`;
const modalAdd = `<AddStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          onStudentAdded={() => {
            setIsAddStudentOpen(false);
            loadDashboardData();
          }}
        />

        <EditStudentModal
          isOpen={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          onStudentEdited={() => {
            setEditingStudent(null);
            loadDashboardData();
          }}
          student={editingStudent}
        />`;
content = content.replace(modalAnchor, modalAdd);

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
