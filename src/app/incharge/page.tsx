'use client';

import React, { useState, useEffect, useMemo } from 'react';
import InchargeAuthGuard from '@/components/InchargeAuthGuard';
import GuestModeBanner from '@/components/GuestModeBanner';
import { getValidSessionUser, logoutUser, SessionUserInfo } from '@/services/authService';
import { createClient } from '@/lib/supabase/client';
import { isGuestMode, getDemoStudents, getDemoBatches } from '@/lib/demo/demoStore';
import { calculatePrintAmount, PrintTypeOption, PrintSideOption } from '@/config/printingRates';
import { postDebitEntries, postCreditEntries, generateWhatsAppLink } from '@/services/ledgerService';
import { getInchargeCashSummary, InchargeCashSummary } from '@/services/inchargeService';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import {
  submitCashHandoverClaim,
  getLatestInchargeHandoverClaim,
  getInchargeHandoverHistory,
  CashHandoverClaim,
} from '@/services/cashHandoverService';
import {
  getAllPaymentClaims,
  verifyPaymentClaim,
  rejectPaymentClaim,
  PaymentClaim,
} from '@/services/paymentClaimsService';
import { formatDate } from '@/utils/formatDate';
import { sortBatches } from '@/services/batchService';
import { Student, Batch } from '@/types/database.types';

export default function InchargeDashboardPage() {
  const [sessionUser, setSessionUser] = useState<SessionUserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'cashSummary' | 'paymentClaims'>('students');

  // Payment claims state for In-Charge
  const [paymentClaims, setPaymentClaims] = useState<PaymentClaim[]>([]);
  const [claimsSubTab, setClaimsSubTab] = useState<'pending' | 'history'>('pending');
  const [verifyingClaimId, setVerifyingClaimId] = useState<string | null>(null);
  const [rejectingClaim, setRejectingClaim] = useState<PaymentClaim | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [claimsNotice, setClaimsNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Data states
  const [students, setStudents] = useState<(Student & { balance: number; batch_name?: string })[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for student tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Group Action Selection State
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [groupActionSuccess, setGroupActionSuccess] = useState<string | null>(null);

  // Action Launcher Modal (Individual vs Group Action Choice Screen)
  const [isActionLauncherOpen, setIsActionLauncherOpen] = useState(false);
  const [launcherStudentId, setLauncherStudentId] = useState<string>('');
  const [launcherMode, setLauncherMode] = useState<'individual' | 'group'>('individual');
  const [launcherSearchQuery, setLauncherSearchQuery] = useState<string>('');
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');

  // Bulk Debit Modal State
  const [isBulkDebitModalOpen, setIsBulkDebitModalOpen] = useState(false);
  const [bulkPrintType, setBulkPrintType] = useState<PrintTypeOption>('bw');
  const [bulkPrintSide, setBulkPrintSide] = useState<PrintSideOption>('single');
  const [bulkNumPages, setBulkNumPages] = useState<number>(1);
  const [bulkDiscount, setBulkDiscount] = useState<number>(0);
  const [bulkDebitDesc, setBulkDebitDesc] = useState('');
  const [bulkPaidImmediately, setBulkPaidImmediately] = useState<boolean>(false);
  const [submittingBulkDebit, setSubmittingBulkDebit] = useState(false);
  const [bulkDebitError, setBulkDebitError] = useState<string | null>(null);

  // Bulk Credit Modal State
  const [isBulkCreditModalOpen, setIsBulkCreditModalOpen] = useState(false);
  const [bulkCreditMode, setBulkCreditMode] = useState<'uniform' | 'custom'>('uniform');
  const [bulkUniformAmount, setBulkUniformAmount] = useState<string>('');
  const [bulkCustomAmounts, setBulkCustomAmounts] = useState<Record<string, string>>({});
  const [bulkCreditDesc, setBulkCreditDesc] = useState('');
  const [submittingBulkCredit, setSubmittingBulkCredit] = useState(false);
  const [bulkCreditError, setBulkCreditError] = useState<string | null>(null);

  // Cash summary state
  const [cashSummary, setCashSummary] = useState<InchargeCashSummary>({
    totalCashOnHand: 0,
    totalTransactionsCount: 0,
    collections: [],
  });
  const [cashSearch, setCashSearch] = useState('');

  // Cash Handover State
  const [latestHandoverClaim, setLatestHandoverClaim] = useState<CashHandoverClaim | null>(null);
  const [handoverHistory, setHandoverHistory] = useState<CashHandoverClaim[]>([]);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverAmount, setHandoverAmount] = useState<string>('');
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handoverSuccess, setHandoverSuccess] = useState<string | null>(null);

  // Modal State for Log Print Job (Debit)
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);
  const [printType, setPrintType] = useState<PrintTypeOption>('bw');
  const [printSide, setPrintSide] = useState<PrintSideOption>('single');
  const [numPages, setNumPages] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
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
  const [creditError, setCreditError] = useState<string | null>(null);

  // Load Initial Data
  const loadDashboardData = async () => {
    setLoading(true);
    const user = await getValidSessionUser();
    setSessionUser(user);

    if (isGuestMode()) {
      const demoStuds = getDemoStudents();
      const demoB = getDemoBatches();

      setStudents(demoStuds);
      setBatches(sortBatches(demoB));

      const summary = await getInchargeCashSummary('demo-incharge-id');
      setCashSummary(summary);
      const latestClaim = await getLatestInchargeHandoverClaim('incharge-demo-user');
      setLatestHandoverClaim(latestClaim);
      const history = await getInchargeHandoverHistory('incharge-demo-user');
      setHandoverHistory(history);

      const pClaims = await getAllPaymentClaims('ALL');
      setPaymentClaims(pClaims || []);

      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      // 1. Fetch batches (sorted by custom rank: JD -> HS -> BS -> General -> Alumni)
      const { data: batchesData } = await supabase.from('batches').select('*');
      const bList = sortBatches((batchesData || []) as Batch[]);
      setBatches(bList);
      const batchMap = new Map(bList.map((b) => [b.id, b.name]));

      // 2. Fetch students & student accounts for balance
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id,
          name,
          phone,
          batch_id,
          status,
          created_at,
          accounts!inner (
            id,
            journal_entry_lines (
              debit_amount,
              credit_amount,
              journal_entries (
                voided_at
              )
            )
          )
        `)
        .eq('status', 'active');

      const formattedStuds = (studentsData || []).map((s: any) => {
        let bal = 0;
        if (s.accounts && s.accounts.length > 0) {
          const lines = s.accounts[0].journal_entry_lines || [];
          lines.forEach((l: any) => {
            if (!l.journal_entries?.voided_at) {
              bal += Number(l.debit_amount || 0) - Number(l.credit_amount || 0);
            }
          });
        }
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          password_hash: '',
          batch_id: s.batch_id,
          status: s.status,
          created_at: s.created_at,
          batch_name: batchMap.get(s.batch_id) || 'Unassigned',
          balance: bal,
        };
      });

      setStudents(formattedStuds);

      // 3. Fetch In-charge cash summary, latest handover claim & handover history
      const summary = await getInchargeCashSummary(user.userId);
      setCashSummary(summary);

      const latestClaim = await getLatestInchargeHandoverClaim(user.userId);
      setLatestHandoverClaim(latestClaim);

      const history = await getInchargeHandoverHistory(user.userId);
      setHandoverHistory(history);

      // 4. Fetch all payment claims
      const pClaims = await getAllPaymentClaims('ALL');
      setPaymentClaims(pClaims || []);
    } catch (err) {
      console.error('Failed to load In-charge dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeMultiSync({
    channelName: 'incharge-portal-sync',
    tables: ['incharge_profiles', 'payment_claims', 'cash_handover_claims', 'journal_entries', 'journal_entry_lines', 'students'],
    onDataChange: () => {
      loadDashboardData();
    },
  });

  // Handle In-Charge Verification of Student Payment Claim
  const handleInchargeVerifyClaim = async (claim: PaymentClaim) => {
    setVerifyingClaimId(claim.id);
    setClaimsNotice(null);

    const studentName = claim.students?.name || 'Student';
    const verifierName = sessionUser?.name || sessionUser?.inchargeEmail || 'Workforce Member';
    const verifierId = sessionUser?.userId || 'Workforce Member';

    const res = await verifyPaymentClaim(claim.id, verifierId, true, verifierName);

    setVerifyingClaimId(null);

    if (res.alreadyHandled) {
      setClaimsNotice({
        type: 'warning',
        text: res.error || 'Notice: This payment claim has already been handled by another workforce member or admin.',
      });
      await loadDashboardData();
    } else if (res.success) {
      setClaimsNotice({
        type: 'success',
        text: `Payment claim of ₹${Number(claim.claimed_amount).toFixed(2)} for ${studentName} verified! Amount credited to student & added to your Cash-on-Hand balance.`,
      });
      await loadDashboardData();
    } else {
      setClaimsNotice({
        type: 'error',
        text: res.error || 'Failed to verify payment claim.',
      });
    }
  };

  // Handle In-Charge Rejection of Student Payment Claim
  const handleInchargeConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingClaim) return;

    setVerifyingClaimId(rejectingClaim.id);
    setClaimsNotice(null);

    const verifierName = sessionUser?.name || sessionUser?.inchargeEmail || 'Workforce Member';
    const verifierId = sessionUser?.userId || 'Workforce Member';

    const res = await rejectPaymentClaim(rejectingClaim.id, rejectNote.trim(), verifierId, verifierName);

    setVerifyingClaimId(null);
    setRejectingClaim(null);
    setRejectNote('');

    if (res.alreadyHandled) {
      setClaimsNotice({
        type: 'warning',
        text: res.error || 'Notice: This payment claim has already been handled by another workforce member or admin.',
      });
      await loadDashboardData();
    } else if (res.success) {
      setClaimsNotice({
        type: 'success',
        text: 'Payment claim marked as rejected.',
      });
      await loadDashboardData();
    } else {
      setClaimsNotice({
        type: 'error',
        text: res.error || 'Failed to reject payment claim.',
      });
    }
  };

  // Open Cash Handover Modal
  const openHandoverModal = () => {
    setHandoverAmount(cashSummary.totalCashOnHand > 0 ? cashSummary.totalCashOnHand.toFixed(2) : '');
    setHandoverError(null);
    setHandoverSuccess(null);
    setIsHandoverModalOpen(true);
  };

  // Submit Cash Handover Claim
  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(handoverAmount);
    if (!numAmt || numAmt <= 0) {
      setHandoverError('Please enter a valid handover cash amount greater than ₹0.00.');
      return;
    }

    setSubmittingHandover(true);
    setHandoverError(null);

    try {
      const activeId = isGuestMode() ? 'incharge-demo-user' : sessionUser?.userId;
      const activeName = sessionUser?.userName || 'Workforce Member';
      const res = await submitCashHandoverClaim(numAmt, activeId, activeName);

      if (res.success) {
        setIsHandoverModalOpen(false);
        setHandoverSuccess(`Cash handover claim of ₹${numAmt.toFixed(2)} submitted successfully! Awaiting admin verification.`);
        await loadDashboardData();
      } else {
        setHandoverError(res.error || 'Failed to submit cash handover claim.');
      }
    } catch (err: any) {
      setHandoverError(err?.message || 'Handover submission error.');
    } finally {
      setSubmittingHandover(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/incharge/login';
  };

  // Filtered student roster
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        (s.batch_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchBatch = selectedBatch === 'all' || s.batch_id === selectedBatch;

      return matchSearch && matchBatch;
    });
  }, [students, searchQuery, selectedBatch]);

  // Filtered student roster for Action Launcher modal
  const launcherFilteredStudents = useMemo(() => {
    if (!launcherSearchQuery.trim()) return students;
    const q = launcherSearchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.batch_name || '').toLowerCase().includes(q) ||
        s.phone.includes(q)
    );
  }, [students, launcherSearchQuery]);

  // Group Action Selection Helpers
  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const visibleIds = filteredStudents.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.has(id));

    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAllInBatch = () => {
    const idsInBatch = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      idsInBatch.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  // Helper to add all active students from a selected batch to group selection
  const addBatchToGroupSelection = (batchId: string) => {
    if (!batchId) return;
    const batchStudents = students.filter((s) => s.batch_id === batchId);
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      batchStudents.forEach((s) => next.add(s.id));
      return next;
    });
  };

  // Helper to add a single student to group selection
  const addStudentToGroupSelection = (studentId: string) => {
    if (!studentId) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  };

  // Helper to remove a single student from group selection
  const removeStudentFromGroupSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  // Dedicated Toolbar Action Triggers
  const handleOpenIndividualAction = () => {
    setLauncherMode('individual');
    setLauncherStudentId(filteredStudents[0]?.id || students[0]?.id || '');
    setLauncherSearchQuery('');
    setIsActionLauncherOpen(true);
  };

  const handleOpenGroupAction = () => {
    setLauncherMode('group');
    setGroupSearchQuery('');
    if (selectedStudentIds.size === 0 && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
    setIsActionLauncherOpen(true);
  };

  // Calculated bulk print price for modal
  const computedBulkPrintCalc = useMemo(() => {
    return calculatePrintAmount(bulkPrintType, bulkPrintSide, bulkNumPages, bulkDiscount);
  }, [bulkPrintType, bulkPrintSide, bulkNumPages, bulkDiscount]);

  // Open Bulk Debit Modal
  const openBulkDebitModal = () => {
    setBulkPrintType('bw');
    setBulkPrintSide('single');
    setBulkNumPages(1);
    setBulkDiscount(0);
    setBulkPaidImmediately(false);
    const batchObj = batches.find((b) => b.id === selectedBatch);
    const batchSuffix = batchObj ? ` - Batch ${batchObj.name}` : '';
    setBulkDebitDesc(`Bulk Print Job (${bulkPrintType.toUpperCase()}, ${bulkPrintSide}, ${bulkNumPages} pages)${batchSuffix}`);
    setBulkDebitError(null);
    setIsBulkDebitModalOpen(true);
  };

  // Submit Bulk Debit
  const handleBulkDebitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) return;

    setSubmittingBulkDebit(true);
    setBulkDebitError(null);

    try {
      const studentIdArray = Array.from(selectedStudentIds);
      const res = await postDebitEntries({
        studentIds: studentIdArray,
        printType: bulkPrintType,
        side: bulkPrintSide,
        numPages: bulkNumPages,
        description: bulkDebitDesc,
        discount: bulkDiscount,
        paidImmediately: bulkPaidImmediately,
        useInchargeCashAccount: true,
      });

      if (res.success) {
        setIsBulkDebitModalOpen(false);
        setGroupActionSuccess(
          `Bulk print job successfully logged for ${res.totalPosted} student${res.totalPosted > 1 ? 's' : ''}! Total debited: ₹${(computedBulkPrintCalc.totalAmount * res.totalPosted).toFixed(2)}.`
        );
        clearSelection();
        await loadDashboardData();
      } else {
        setBulkDebitError(res.error || 'Failed to post bulk print job entries.');
      }
    } catch (err: any) {
      setBulkDebitError(err?.message || 'Bulk debit post error.');
    } finally {
      setSubmittingBulkDebit(false);
    }
  };

  // Open Bulk Credit Modal
  const openBulkCreditModal = () => {
    setBulkCreditMode('uniform');
    setBulkUniformAmount('');
    const selectedStudObjs = students.filter((s) => selectedStudentIds.has(s.id));
    const initialCustom: Record<string, string> = {};
    selectedStudObjs.forEach((s) => {
      initialCustom[s.id] = s.balance > 0 ? s.balance.toFixed(2) : '0.00';
    });
    setBulkCustomAmounts(initialCustom);
    const batchObj = batches.find((b) => b.id === selectedBatch);
    const batchSuffix = batchObj ? ` - Batch ${batchObj.name}` : '';
    setBulkCreditDesc(`Group cash payment received${batchSuffix}`);
    setBulkCreditError(null);
    setIsBulkCreditModalOpen(true);
  };

  // Submit Bulk Credit
  const handleBulkCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) return;

    const selectedStudObjs = students.filter((s) => selectedStudentIds.has(s.id));

    setSubmittingBulkCredit(true);
    setBulkCreditError(null);

    const staffName = sessionUser?.userName || sessionUser?.inchargeEmail || 'Workforce Member';

    try {
      let totalAmountCollected = 0;
      let totalSuccessCount = 0;

      if (bulkCreditMode === 'uniform') {
        const uAmt = Number(bulkUniformAmount);
        if (!uAmt || uAmt <= 0) {
          setBulkCreditError('Please enter a valid uniform cash amount greater than ₹0.00.');
          setSubmittingBulkCredit(false);
          return;
        }

        const finalDesc = bulkCreditDesc.includes('collected by')
          ? bulkCreditDesc
          : `${bulkCreditDesc} — collected by ${staffName}`;

        const res = await postCreditEntries({
          studentIds: Array.from(selectedStudentIds),
          amount: uAmt,
          description: finalDesc,
          useInchargeCashAccount: true,
        });

        if (res.success) {
          totalSuccessCount = res.totalPosted;
          totalAmountCollected = uAmt * res.totalPosted;
        } else {
          setBulkCreditError(res.error || 'Failed to post bulk credit entries.');
          setSubmittingBulkCredit(false);
          return;
        }
      } else {
        // Custom amounts per student
        for (const stud of selectedStudObjs) {
          const amtStr = bulkCustomAmounts[stud.id] || '0';
          const amtNum = Number(amtStr);
          if (amtNum > 0) {
            const baseDesc = bulkCreditDesc || `Cash payment received from ${stud.name}`;
            const finalDesc = baseDesc.includes('collected by')
              ? baseDesc
              : `${baseDesc} — collected by ${staffName}`;

            const res = await postCreditEntries({
              studentIds: [stud.id],
              amount: amtNum,
              description: finalDesc,
              useInchargeCashAccount: true,
            });
            if (res.success) {
              totalSuccessCount++;
              totalAmountCollected += amtNum;
            }
          }
        }
      }

      if (totalSuccessCount > 0) {
        setIsBulkCreditModalOpen(false);
        setGroupActionSuccess(
          `Bulk cash payment recorded for ${totalSuccessCount} student${totalSuccessCount > 1 ? 's' : ''}! Total collected: ₹${totalAmountCollected.toFixed(2)}.`
        );
        clearSelection();
        await loadDashboardData();
      } else {
        setBulkCreditError('No cash payments were processed.');
      }
    } catch (err: any) {
      setBulkCreditError(err?.message || 'Bulk credit post error.');
    } finally {
      setSubmittingBulkCredit(false);
    }
  };

  // Calculated print price for modal
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
    setDebitDesc(`Print Job (B/W, single, 1 pages)`);
    setDebitError(null);
    setIsDebitModalOpen(true);
  };

  // Handle Log Print Job Submit
  const handleDebitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentForDebit) return;

    setSubmittingDebit(true);
    setDebitError(null);

    try {
      const res = await postDebitEntries({
        studentIds: [targetStudentForDebit.id],
        printType,
        side: printSide,
        numPages,
        description: debitDesc,
        discount,
        paidImmediately,
        useInchargeCashAccount: true,
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
  const openCreditModal = (student: Student & { balance: number }) => {
    const staffName = sessionUser?.userName || sessionUser?.inchargeEmail || 'Workforce Member';
    setTargetStudentForCredit(student);
    setCreditAmount(student.balance > 0 ? student.balance.toFixed(2) : '');
    setCreditDesc(`Cash payment received from ${student.name} — collected by ${staffName}`);
    setCreditError(null);
    setIsCreditModalOpen(true);
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
      : `${creditDesc} — collected by ${staffName}`;

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
  };

  // Filtered collections list
  const filteredCollections = useMemo(() => {
    return cashSummary.collections.filter((c) => {
      return (
        c.studentName?.toLowerCase().includes(cashSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(cashSearch.toLowerCase())
      );
    });
  }, [cashSummary.collections, cashSearch]);

  return (
    <InchargeAuthGuard>
      <GuestModeBanner />
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-slate-950">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* HEADER BAR */}
          <header className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
            {/* Top Row: User Profile Info & Logout */}
            <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-950 shrink-0">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center border border-indigo-500/30">
                    <span className="text-lg font-black tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-200 bg-clip-text text-transparent">
                      LAB
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-black text-white tracking-tight break-words">
                      {sessionUser?.inchargeName || 'Workforce Member'}
                    </h1>
                    {sessionUser?.staffId && (
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-mono text-xs font-bold px-2.5 py-0.5 rounded-md shadow-sm shrink-0">
                        ID: #{sessionUser.staffId}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 border border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
                      Workforce Portal
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono flex items-center gap-2 flex-wrap">
                    <span className="break-all">{sessionUser?.inchargeEmail || 'incharge@lab.com'}</span>
                    {sessionUser?.staffId ? (
                      <span className="text-[11px] text-indigo-300/80 font-mono">
                        (Workforce ID: #{sessionUser.staffId})
                      </span>
                    ) : sessionUser?.userId ? (
                      <span className="text-[11px] text-slate-500 font-sans">
                        (Auth ID: {sessionUser.userId.substring(0, 8)}...)
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="bg-slate-800/90 hover:bg-red-950/70 hover:border-red-800/80 text-slate-300 hover:text-red-300 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 shrink-0 self-start sm:self-center group"
              >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>

            {/* Subtle Divider Line */}
            <div className="border-t border-slate-800/90" />

            {/* Bottom Row: Tab Navigation Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              {/* Tab 1: Student Debits & Cash */}
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border ${
                  activeTab === 'students'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-950/60 border-indigo-400/30'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-800/80'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 ${activeTab === 'students' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Student Debits & Cash</span>
              </button>

              {/* Tab 2: Student Payment Claims */}
              <button
                type="button"
                onClick={() => setActiveTab('paymentClaims')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border ${
                  activeTab === 'paymentClaims'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-950/60 border-indigo-400/30'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-800/80'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 ${activeTab === 'paymentClaims' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Student Payment Claims</span>
                {paymentClaims.filter((c) => c.status === 'pending').length > 0 && (
                  <span className="bg-amber-500 text-slate-950 font-black text-[10px] font-mono px-1.5 py-0.5 rounded-full shadow-sm">
                    {paymentClaims.filter((c) => c.status === 'pending').length}
                  </span>
                )}
              </button>

              {/* Tab 3: My Cash Collection Summary */}
              <button
                type="button"
                onClick={() => setActiveTab('cashSummary')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border ${
                  activeTab === 'cashSummary'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-950/60 border-indigo-400/30'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-800/80'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 ${activeTab === 'cashSummary' ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>My Cash Collection Summary</span>
              </button>
            </div>
          </header>

          {/* TAB 1: STUDENT DEBIT & CASH COLLECTION MANAGEMENT */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              {/* Group Action Success Alert */}
              {groupActionSuccess && (
                <div className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-medium p-4 rounded-xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{groupActionSuccess}</span>
                  </div>
                  <button type="button" onClick={() => setGroupActionSuccess(null)} className="text-emerald-400 hover:text-emerald-200 text-sm">×</button>
                </div>
              )}

              {/* Controls & Filters */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search student by name, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  {/* Batch Filter Dropdown (Sorted by JD -> HS -> BS -> General -> Alumni) */}
                  <select
                    value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-all w-full sm:w-auto font-mono"
                  >
                    <option value="all">All Batches ({students.length})</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* DEDICATED TOOLBAR BUTTONS */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-xs text-slate-400 font-mono hidden lg:block mr-1">
                    Showing <strong className="text-white">{filteredStudents.length}</strong> students
                  </div>

                  {/* Button 1: Individual Action */}
                  <button
                    type="button"
                    onClick={handleOpenIndividualAction}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-all border border-indigo-400/30 shadow-indigo-950/40"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Log Print Job</span>
                  </button>

                  {/* Button 2: Group Action */}
                  <button
                    type="button"
                    onClick={handleOpenGroupAction}
                    className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-all border border-emerald-400/40 shadow-emerald-950/40"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Group Action</span>
                  </button>
                </div>
              </div>

              {/* Student Table */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                {loading ? (
                  <div className="p-12 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span>Loading student records...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 font-mono">
                    No matching student records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3.5 font-bold">Student Name</th>
                          <th className="px-4 py-3.5 font-bold">Batch</th>
                          <th className="px-4 py-3.5 font-bold">Phone</th>
                          <th className="px-4 py-3.5 font-bold text-right">Current Balance</th>
                          <th className="px-4 py-3.5 font-bold text-center">Workforce Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredStudents.map((stud) => {
                          const isOverdue = stud.balance > 0;
                          return (
                            <tr key={stud.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-4 font-bold text-white">{stud.name}</td>
                              <td className="px-4 py-4 font-mono text-slate-400">{stud.batch_name}</td>
                              <td className="px-4 py-4 font-mono text-slate-400">{stud.phone}</td>
                              <td className="px-4 py-4 font-mono font-bold text-right text-base">
                                <span className={isOverdue ? 'text-red-400' : 'text-emerald-400'}>
                                  ₹{Math.abs(stud.balance).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  {/* Collect Cash Payment Button */}
                                  <button
                                    type="button"
                                    onClick={() => openCreditModal(stud)}
                                    className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"
                                    title="Collect cash payment from student"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Collect Cash</span>
                                  </button>

                                  {/* WhatsApp Reminder */}
                                  {isOverdue && (
                                    <a
                                      href={generateWhatsAppLink(stud.phone, stud.name, stud.balance)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/60 px-2.5 py-1.5 rounded-lg text-xs transition-all font-semibold"
                                      title="Send WhatsApp payment reminder"
                                    >
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MY CASH COLLECTION SUMMARY */}
          {activeTab === 'cashSummary' && (
            <div className="space-y-6">
              {/* Handover Success Alert */}
              {handoverSuccess && (
                <div className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-medium p-4 rounded-xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{handoverSuccess}</span>
                  </div>
                  <button type="button" onClick={() => setHandoverSuccess(null)} className="text-emerald-400 hover:text-emerald-200 text-sm">×</button>
                </div>
              )}

              {/* Pending Handover Status Card */}
              {latestHandoverClaim && latestHandoverClaim.status === 'pending' && (
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-5 shadow-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider">
                      Handover Pending Admin Verification
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full animate-pulse">
                      Awaiting Admin
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-300 font-mono">
                      ₹{Number(latestHandoverClaim.claimed_amount).toFixed(2)}
                    </span>
                    <span className="text-xs text-amber-200/80">
                      submitted on {new Date(latestHandoverClaim.claimed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/70">
                    Your physical cash handover request is currently awaiting admin verification. Once verified, cash will transfer to the organization's main cash account.
                  </p>
                </div>
              )}

              {/* Rejected Handover Status Card */}
              {latestHandoverClaim && latestHandoverClaim.status === 'rejected' && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-5 shadow-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-red-400 tracking-wider">
                      Previous Handover Claim Rejected
                    </span>
                    <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full">
                      Rejected by Admin
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-red-200">
                    Reason: {latestHandoverClaim.admin_note || 'Physical cash mismatch detected by admin.'}
                  </div>
                  <p className="text-xs text-red-300/70">
                    Please count your physical cash in hand and submit a corrected handover claim below.
                  </p>
                </div>
              )}

              {/* Hero KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Cash On Hand Card */}
                {(() => {
                  const pendingClaimAmount = (latestHandoverClaim && latestHandoverClaim.status === 'pending') ? Number(latestHandoverClaim.claimed_amount) : 0;
                  const availableCashOnHand = Math.max(0, cashSummary.totalCashOnHand - pendingClaimAmount);

                  return (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              My Cash On Hand
                            </span>
                            <span className="text-[10px] text-indigo-400 font-mono">
                              Cash in Hand (Workforce clearing balance)
                            </span>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-3xl font-black text-emerald-400 font-mono mt-2">
                          ₹{availableCashOnHand.toFixed(2)}
                          <span className="text-xs text-emerald-500 font-sans font-semibold ml-2">Available</span>
                        </div>

                        {pendingClaimAmount > 0 && (
                          <div className="mt-3 bg-amber-950/40 border border-amber-800/40 rounded-xl p-2.5 text-xs font-mono space-y-1">
                            <div className="flex justify-between text-amber-300">
                              <span>Pending Verification:</span>
                              <span className="font-bold">₹{pendingClaimAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 text-[11px]">
                              <span>Total Ledger Balance:</span>
                              <span>₹{cashSummary.totalCashOnHand.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-slate-500">
                          Un-handed-over physical cash in your custody.
                        </p>
                        <button
                          type="button"
                          onClick={openHandoverModal}
                          disabled={availableCashOnHand <= 0 || latestHandoverClaim?.status === 'pending'}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-md flex-shrink-0 flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span>
                            {latestHandoverClaim?.status === 'pending'
                              ? 'Handover Pending'
                              : 'Hand Over to Admin'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Total Transactions Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Cash Transactions Count
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Personal cash collection entries
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-2">
                    {cashSummary.totalTransactionsCount}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Individual receipts processed at the counter.
                  </p>
                </div>
              </div>

              {/* Search Filter & Table */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <h2 className="text-base font-bold text-white">Cash Receipts Breakdown</h2>
                  <div className="relative w-full sm:w-72">
                    <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Filter collections by student or description..."
                      value={cashSearch}
                      onChange={(e) => setCashSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {filteredCollections.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950/60 rounded-xl border border-slate-800">
                    No cash collection records matching your filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5 font-bold">Date & Time</th>
                          <th className="px-5 py-3.5 font-bold">Student Name</th>
                          <th className="px-5 py-3.5 font-bold">Entry Description</th>
                          <th className="px-5 py-3.5 font-bold text-right">Cash Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredCollections.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-slate-400">
                              {new Date(item.date).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-white">{item.studentName || 'Student'}</td>
                            <td className="px-5 py-3.5 text-slate-300">{item.description}</td>
                            <td className="px-5 py-3.5 font-mono font-bold text-right text-emerald-400 text-sm">
                              ₹{item.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* My Cash Handover History Section */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">My Cash Handover History</h2>
                    <p className="text-xs text-slate-400">Past cash transfer claims submitted to admin for physical verification.</p>
                  </div>
                </div>

                {handoverHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950/60 rounded-xl border border-slate-800">
                    No cash handover claims submitted yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5 font-bold">Submission Date & Time</th>
                          <th className="px-5 py-3.5 font-bold">Claimed Amount</th>
                          <th className="px-5 py-3.5 font-bold">Handover Status</th>
                          <th className="px-5 py-3.5 font-bold">Verification Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {handoverHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-slate-400">
                              {new Date(item.claimed_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="px-5 py-3.5 font-mono font-bold text-white text-sm">
                              ₹{Number(item.claimed_amount).toFixed(2)}
                            </td>
                            <td className="px-5 py-3.5">
                              {item.status === 'pending' && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-full">
                                  Pending Verification
                                </span>
                              )}
                              {item.status === 'verified' && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-full">
                                  Verified & Transferred
                                </span>
                              )}
                              {item.status === 'rejected' && (
                                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold uppercase font-mono px-2.5 py-1 rounded-full">
                                  Claim Rejected
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-400 text-xs">
                              {item.status === 'verified' && (
                                <span>Verified by {item.verified_by || 'Admin'} on {item.verified_at ? new Date(item.verified_at).toLocaleDateString('en-IN') : 'N/A'}</span>
                              )}
                              {item.status === 'rejected' && (
                                <span className="text-red-300 font-semibold">Reason: {item.admin_note || 'Physical cash mismatch detected.'}</span>
                              )}
                              {item.status === 'pending' && (
                                <span className="text-amber-400/80 italic">Awaiting admin physical cash count verification</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STUDENT PAYMENT CLAIMS */}
          {activeTab === 'paymentClaims' && (
            <div className="space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                        UPI Payment Verification Queue
                      </span>
                      {paymentClaims.filter((c) => c.status === 'pending').length > 0 && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                          {paymentClaims.filter((c) => c.status === 'pending').length} Pending
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-black text-white mt-1">Student Payment Claims</h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                      Review UPI payment claims submitted by students. Verifying a claim credits the student&apos;s account balance and automatically adds the funds to your personal Cash-on-Hand balance.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadDashboardData}
                    disabled={loading}
                    className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto"
                  >
                    <svg className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Claims Queue
                  </button>
                </div>

                {/* Global Claims Notice Banner */}
                {claimsNotice && (
                  <div
                    className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-lg ${
                      claimsNotice.type === 'success'
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : claimsNotice.type === 'warning'
                        ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                        : 'bg-red-950/80 border-red-800 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {claimsNotice.type === 'warning' && (
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <span>{claimsNotice.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClaimsNotice(null)}
                      className="text-slate-400 hover:text-white font-bold text-sm ml-4"
                    >
                      &times;
                    </button>
                  </div>
                )}

                {/* Sub-tabs */}
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit gap-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setClaimsSubTab('pending')}
                    className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      claimsSubTab === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Pending Queue
                    <span className="bg-amber-500/30 text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {paymentClaims.filter((c) => c.status === 'pending').length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimsSubTab('history')}
                    className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      claimsSubTab === 'history'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Processed History
                    <span className="bg-indigo-500/30 text-indigo-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {paymentClaims.filter((c) => c.status !== 'pending').length}
                    </span>
                  </button>
                </div>

                {/* PENDING CLAIMS TABLE */}
                {claimsSubTab === 'pending' && (
                  paymentClaims.filter((c) => c.status === 'pending').length === 0 ? (
                    <div className="p-12 text-center space-y-2 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                      <span className="text-emerald-400 font-bold text-sm block">✓ No Pending Payment Claims</span>
                      <p className="text-xs text-slate-400">
                        All student UPI payment submissions have been verified or processed.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-4 font-bold font-sans">Student Name</th>
                            <th className="p-4 font-bold">Batch</th>
                            <th className="p-4 font-bold text-right">Claimed Amount</th>
                            <th className="p-4 font-bold">Submitted Date</th>
                            <th className="p-4 font-bold">Reference / UPI Ref</th>
                            <th className="p-4 font-bold text-center font-sans">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {paymentClaims
                            .filter((c) => c.status === 'pending')
                            .map((claim) => {
                              const studentName = claim.students?.name || 'Student';
                              const studentPhone = claim.students?.phone || '';
                              const batchName = claim.students?.batches?.name || 'Unassigned';

                              return (
                                <tr key={claim.id} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="p-4 font-sans">
                                    <div className="font-bold text-white text-sm">{studentName}</div>
                                    {studentPhone && <div className="text-emerald-400 text-xs font-mono">{studentPhone}</div>}
                                  </td>
                                  <td className="p-4 text-slate-300">
                                    <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
                                      {batchName}
                                    </span>
                                  </td>
                                  <td className="p-4 font-black text-emerald-400 text-base text-right">
                                    ₹{Number(claim.claimed_amount).toFixed(2)}
                                  </td>
                                  <td className="p-4 text-slate-400 text-[11px]">
                                    {formatDate(claim.claimed_at)}
                                  </td>
                                  <td className="p-4 text-slate-300 font-sans text-xs max-w-xs truncate">
                                    {claim.upi_tn || '-'}
                                  </td>
                                  <td className="p-4 text-center font-sans">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleInchargeVerifyClaim(claim)}
                                        disabled={verifyingClaimId === claim.id}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                                      >
                                        {verifyingClaimId === claim.id ? (
                                          <span>Verifying...</span>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Verify & Add to Cash</span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectingClaim(claim);
                                          setRejectNote('');
                                        }}
                                        disabled={verifyingClaimId === claim.id}
                                        className="bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-xl transition-all"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* HISTORY CLAIMS TABLE */}
                {claimsSubTab === 'history' && (
                  paymentClaims.filter((c) => c.status !== 'pending').length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-mono bg-slate-950/60 rounded-2xl border border-slate-800/80">
                      No processed payment claim history available.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-4 font-bold font-sans">Student Name</th>
                            <th className="p-4 font-bold text-right">Claimed Amount</th>
                            <th className="p-4 font-bold text-center">Status</th>
                            <th className="p-4 font-bold">Processed By</th>
                            <th className="p-4 font-bold">Processed At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {paymentClaims
                            .filter((c) => c.status !== 'pending')
                            .map((claim) => (
                              <tr key={claim.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-4 font-sans font-bold text-white text-sm">
                                  {claim.students?.name || 'Student'}
                                </td>
                                <td className="p-4 font-bold text-emerald-400 text-right text-sm">
                                  ₹{Number(claim.claimed_amount).toFixed(2)}
                                </td>
                                <td className="p-4 text-center">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                      claim.status === 'verified'
                                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                                        : 'bg-red-950 border border-red-800 text-red-300'
                                    }`}
                                  >
                                    {claim.status}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-300 font-sans text-xs">
                                  {claim.verified_by || '-'}
                                </td>
                                <td className="p-4 text-slate-400 text-[11px]">
                                  {claim.verified_at ? formatDate(claim.verified_at) : '-'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL 1: LOG PRINT JOB (DEBIT ENTRY) */}
        {isDebitModalOpen && targetStudentForDebit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">
                    Workforce Action
                  </span>
                  <h3 className="text-lg font-bold text-white">Log Print Job (Debit Entry)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDebitModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Student</span>
                <span className="text-white font-bold text-sm">{targetStudentForDebit.name}</span>
                <span className="text-slate-400 font-mono block text-[11px] mt-0.5">
                  Current Balance: ₹{Math.abs(targetStudentForDebit.balance).toFixed(2)}
                </span>
              </div>

              {debitError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {debitError}
                </div>
              )}

              <form onSubmit={handleDebitSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Print Type
                    </label>
                    <select
                      value={printType}
                      onChange={(e) => setPrintType(e.target.value as PrintTypeOption)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="bw">B/W (₹1/page)</option>
                      <option value="color">Color (₹5/page)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Side
                    </label>
                    <select
                      value={printSide}
                      onChange={(e) => setPrintSide(e.target.value as PrintSideOption)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="single">Single Sided</option>
                      <option value="double">Double Sided</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Number of Pages
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={numPages}
                      onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Entry Description
                  </label>
                  <input
                    type="text"
                    value={debitDesc}
                    onChange={(e) => setDebitDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Paid in Cash Immediately Toggle Card */}
                <div
                  onClick={() => setPaidImmediately(!paidImmediately)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    paidImmediately
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        paidImmediately
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/50'
                          : 'bg-slate-900 border-slate-700 text-transparent'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <span className={`text-xs font-bold transition-colors ${paidImmediately ? 'text-emerald-300' : 'text-slate-200'}`}>
                        Paid in Cash Immediately
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {paidImmediately
                          ? 'Posts to Cash in Hand (Workforce). Balance unaffected.'
                          : 'Posts as Accounts Receivable due from student.'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider shrink-0 transition-colors ${
                      paidImmediately
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {paidImmediately ? 'Cash Sale' : 'On Credit'}
                  </span>
                </div>

                {/* Computed Total Amount Display */}
                <div className="bg-indigo-950/60 border border-indigo-800/60 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-300">Total Debit Amount:</span>
                  <span className="text-base font-black text-white font-mono">
                    ₹{computedPrintCalc.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDebitModalOpen(false)}
                    disabled={submittingDebit}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
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
            </div>
          </div>
        )}

        {/* MODAL 2: RECEIVE CASH PAYMENT (CREDIT ENTRY) */}
        {isCreditModalOpen && targetStudentForCredit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                    Counter Cash Entry
                  </span>
                  <h3 className="text-lg font-bold text-white">Receive Cash Payment</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Student</span>
                <span className="text-white font-bold text-sm">{targetStudentForCredit.name}</span>
                <span className="text-slate-400 font-mono block text-[11px] mt-0.5">
                  Current Receivable Due: ₹{Math.abs(targetStudentForCredit.balance).toFixed(2)}
                </span>
              </div>

              {creditError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {creditError}
                </div>
              )}

              <form onSubmit={handleCreditSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    value={creditDesc}
                    onChange={(e) => setCreditDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreditModalOpen(false)}
                    disabled={submittingCredit}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
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
            </div>
          </div>
        )}

        {/* MODAL 3: HAND OVER CASH TO ADMIN */}
        {isHandoverModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                    Cash Custody Handover
                  </span>
                  <h3 className="text-lg font-bold text-white">Hand Over Cash to Admin</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Cash in Hand</span>
                <span className="text-emerald-400 font-mono font-black text-xl block">
                  ₹{cashSummary.totalCashOnHand.toFixed(2)}
                </span>
                <span className="text-slate-400 text-[11px] block pt-1 border-t border-slate-800/80">
                  Submitting creates a handover claim. Upon admin physical verification, cash will transfer into the organization's main cash account.
                </span>
              </div>

              {handoverError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {handoverError}
                </div>
              )}

              <form onSubmit={handleHandoverSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Cash Amount to Hand Over (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={cashSummary.totalCashOnHand}
                    required
                    placeholder="0.00"
                    value={handoverAmount}
                    onChange={(e) => setHandoverAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Pre-filled with your current total cash on hand. You can edit this for partial handovers.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsHandoverModalOpen(false)}
                    disabled={submittingHandover}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingHandover}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2"
                  >
                    {submittingHandover ? 'Submitting Handover...' : 'Submit Handover Claim'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: BULK PRINT DEBIT (GROUP ACTION) */}
        {isBulkDebitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">
                    Group Action • Bulk Debit
                  </span>
                  <h3 className="text-lg font-bold text-white">Log Bulk Print Job</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkDebitModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Target Students:</span>
                <span className="bg-indigo-900/60 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full border border-indigo-700">
                  {selectedStudentIds.size} Students Selected
                </span>
              </div>

              {bulkDebitError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {bulkDebitError}
                </div>
              )}

              <form onSubmit={handleBulkDebitSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Print Type</label>
                    <select
                      value={bulkPrintType}
                      onChange={(e) => setBulkPrintType(e.target.value as PrintTypeOption)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="bw">Black & White (B/W)</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Side</label>
                    <select
                      value={bulkPrintSide}
                      onChange={(e) => setBulkPrintSide(e.target.value as PrintSideOption)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="single">Single-Sided</option>
                      <option value="double">Double-Sided</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Pages per Student</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={bulkNumPages}
                      onChange={(e) => setBulkNumPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Discount per Student (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={bulkDiscount}
                      onChange={(e) => setBulkDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description / Memo</label>
                  <input
                    type="text"
                    required
                    value={bulkDebitDesc}
                    onChange={(e) => setBulkDebitDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Paid in Cash Immediately Toggle Card */}
                <div
                  onClick={() => setBulkPaidImmediately(!bulkPaidImmediately)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    bulkPaidImmediately
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        bulkPaidImmediately
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/50'
                          : 'bg-slate-900 border-slate-700 text-transparent'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <span className={`text-xs font-bold transition-colors ${bulkPaidImmediately ? 'text-emerald-300' : 'text-slate-200'}`}>
                        Paid in Cash Immediately
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {bulkPaidImmediately
                          ? 'Batch posted to Cash in Hand (Workforce). Balances unaffected.'
                          : 'Batch posted as Accounts Receivable due from students.'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider shrink-0 transition-colors ${
                      bulkPaidImmediately
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {bulkPaidImmediately ? 'Cash Sale' : 'On Credit'}
                  </span>
                </div>

                {/* Price Summary Calculation */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Charge per Student:</span>
                    <span className="text-white font-bold">₹{computedBulkPrintCalc.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Selected Students:</span>
                    <span className="text-white font-bold">{selectedStudentIds.size}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
                    <span className="font-bold text-slate-200">Total Group Debit:</span>
                    <span className="font-black text-indigo-400 font-mono">
                      ₹{(computedBulkPrintCalc.totalAmount * selectedStudentIds.size).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkDebitModalOpen(false)}
                    disabled={submittingBulkDebit}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBulkDebit}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2"
                  >
                    {submittingBulkDebit ? 'Posting Entries...' : `Post Debits (${selectedStudentIds.size} Students)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: BULK CASH PAYMENT (GROUP ACTION) */}
        {isBulkCreditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                    Group Action • Cash Collection
                  </span>
                  <h3 className="text-lg font-bold text-white">Bulk Cash Payment Collection</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkCreditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mode Selector */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                <button
                  type="button"
                  onClick={() => setBulkCreditMode('uniform')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    bulkCreditMode === 'uniform'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Uniform Amount per Student
                </button>
                <button
                  type="button"
                  onClick={() => setBulkCreditMode('custom')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    bulkCreditMode === 'custom'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Amount per Student
                </button>
              </div>

              {bulkCreditError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {bulkCreditError}
                </div>
              )}

              <form onSubmit={handleBulkCreditSubmit} className="space-y-4">
                {bulkCreditMode === 'uniform' ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Cash Amount Collected per Student (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="e.g. 500.00"
                      value={bulkUniformAmount}
                      onChange={(e) => setBulkUniformAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Applies ₹{Number(bulkUniformAmount || 0).toFixed(2)} cash credit to each of the {selectedStudentIds.size} selected students.
                    </span>
                  </div>
                ) : (
                  /* Custom amounts table */
                  <div className="space-y-2 max-h-56 overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-950">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-2">
                      Set Custom Payment Amount per Student
                    </span>
                    {students
                      .filter((s) => selectedStudentIds.has(s.id))
                      .map((stud) => (
                        <div key={stud.id} className="flex items-center justify-between gap-3 text-xs border-b border-slate-800/60 pb-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-white block truncate">{stud.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Due: ₹{Math.abs(stud.balance).toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={bulkCustomAmounts[stud.id] || ''}
                            onChange={(e) =>
                              setBulkCustomAmounts((prev) => ({ ...prev, [stud.id]: e.target.value }))
                            }
                            placeholder="0.00"
                            className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 text-right"
                          />
                        </div>
                      ))}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description / Memo</label>
                  <input
                    type="text"
                    required
                    value={bulkCreditDesc}
                    onChange={(e) => setBulkCreditDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Total Calculation */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Total Cash Collected:</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    ₹
                    {bulkCreditMode === 'uniform'
                      ? (Number(bulkUniformAmount || 0) * selectedStudentIds.size).toFixed(2)
                      : Object.values(bulkCustomAmounts)
                          .reduce((sum, val) => sum + (Number(val) || 0), 0)
                          .toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkCreditModalOpen(false)}
                    disabled={submittingBulkCredit}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBulkCredit}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2"
                  >
                    {submittingBulkCredit ? 'Processing Payments...' : `Collect Cash (${selectedStudentIds.size} Students)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 6: ACTION LAUNCHER (CONTEXT-AWARE INDIVIDUAL VS GROUP ACTION) */}
        {isActionLauncherOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">
                    Workforce Action Launcher
                  </span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {launcherMode === 'group' ? (
                      <>
                        <span>Group Action Mode</span>
                        <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-normal px-2.5 py-0.5 rounded-full">
                          {selectedStudentIds.size} Students Pre-Loaded
                        </span>
                      </>
                    ) : (
                      <span>Individual Student Action</span>
                    )}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActionLauncherOpen(false)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* LAUNCHER CONTENT */}
              {launcherMode === 'group' ? (
                /* GROUP ACTION FLEXIBLE SELECTION STEP */
                <div className="space-y-4">
                  {/* Step 1: Batch Dropdown & Individual Search Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {/* Batch Quick Add */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                        1. Select Whole Batch
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addBatchToGroupSelection(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono h-9"
                      >
                        <option value="" disabled>
                          -- Pick a batch to add all students --
                        </option>
                        {batches.map((b) => {
                          const count = students.filter((s) => s.batch_id === b.id).length;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} (+{count} students)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Individual Student Search & Add */}
                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                        2. Search & Add Student
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search name, batch, phone..."
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono h-9"
                        />
                        <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>

                        {/* Floating Search Results Dropdown */}
                        {groupSearchQuery.trim() !== '' && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-800 shadow-2xl">
                            {students
                              .filter(
                                (s) =>
                                  s.name.toLowerCase().includes(groupSearchQuery.toLowerCase().trim()) ||
                                  (s.batch_name || '').toLowerCase().includes(groupSearchQuery.toLowerCase().trim()) ||
                                  s.phone.includes(groupSearchQuery.trim())
                              )
                              .slice(0, 10)
                              .map((s) => {
                                const isAlreadyAdded = selectedStudentIds.has(s.id);
                                return (
                                  <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => {
                                      addStudentToGroupSelection(s.id);
                                      setGroupSearchQuery('');
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                      isAlreadyAdded
                                        ? 'bg-indigo-950/60 text-indigo-300'
                                        : 'hover:bg-slate-800 text-slate-200'
                                    }`}
                                  >
                                    <div>
                                      <span className="font-semibold">{s.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono ml-2">({s.batch_name || 'General'})</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-indigo-400">
                                      {isAlreadyAdded ? '✓ Added' : '+ Add'}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assembled Running Roster List */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          Selected Target Roster
                        </h4>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800">
                          {selectedStudentIds.size} Students
                        </span>
                      </div>

                      {selectedStudentIds.size > 0 && (
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="text-[11px] text-red-400 hover:text-red-300 font-mono font-semibold transition-colors"
                        >
                          Clear All ({selectedStudentIds.size})
                        </button>
                      )}
                    </div>

                    {selectedStudentIds.size === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-lg">
                        No students selected yet. Pick a batch above or search and add individual students.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {Array.from(selectedStudentIds).map((id) => {
                          const s = students.find((stud) => stud.id === id);
                          if (!s) return null;
                          return (
                            <div
                              key={s.id}
                              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{s.name}</span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                  {s.batch_name || 'General'}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  Due: ₹{s.balance.toFixed(2)}
                                </span>
                              </div>

                              {/* Remove / Exclude Individual Student Button */}
                              <button
                                type="button"
                                onClick={() => removeStudentFromGroupSelection(s.id)}
                                className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                                title={`Remove ${s.name} from group selection`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Group Action Option Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={selectedStudentIds.size === 0}
                      onClick={() => {
                        setIsActionLauncherOpen(false);
                        openBulkDebitModal();
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                        selectedStudentIds.size > 0
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Log Bulk Print Debit ({selectedStudentIds.size})</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedStudentIds.size === 0}
                      onClick={() => {
                        setIsActionLauncherOpen(false);
                        openBulkCreditModal();
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                        selectedStudentIds.size > 0
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Collect Bulk Cash ({selectedStudentIds.size})</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* INDIVIDUAL STUDENT FLOW DIRECT OPTIONS */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">
                      Search & Select Target Student
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type student name, batch, or phone..."
                        value={launcherSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLauncherSearchQuery(val);
                          const q = val.toLowerCase().trim();
                          const matched = students.filter(
                            (s) =>
                              s.name.toLowerCase().includes(q) ||
                              (s.batch_name || '').toLowerCase().includes(q) ||
                              s.phone.includes(q)
                          );
                          if (matched.length > 0 && !matched.some((m) => m.id === launcherStudentId)) {
                            setLauncherStudentId(matched[0].id);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {launcherSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setLauncherSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <select
                      value={launcherStudentId}
                      onChange={(e) => setLauncherStudentId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {launcherFilteredStudents.length === 0 ? (
                        <option value="">No matching students found</option>
                      ) : (
                        launcherFilteredStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.batch_name || 'General'}) — Due: ₹{s.balance.toFixed(2)}
                          </option>
                        ))
                      )}
                    </select>

                    {launcherSearchQuery && (
                      <p className="text-[10px] text-slate-400 font-mono text-right">
                        Showing {launcherFilteredStudents.length} of {students.length} students
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const target = students.find((s) => s.id === launcherStudentId) || students[0];
                        if (target) {
                          setIsActionLauncherOpen(false);
                          openDebitModal(target);
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Log Print Job (Debit)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const target = students.find((s) => s.id === launcherStudentId) || students[0];
                        if (target) {
                          setIsActionLauncherOpen(false);
                          openCreditModal(target);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Receive Cash (Credit)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: IN-CHARGE REJECT CLAIM */}
        {rejectingClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 font-mono block">
                    Workforce Action
                  </span>
                  <h3 className="text-lg font-bold text-white">Reject Student Payment Claim</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectingClaim(null)}
                  className="text-slate-400 hover:text-slate-200 bg-slate-800 p-1.5 rounded-lg"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Rejecting claim of <span className="font-bold text-emerald-400 font-mono">₹{Number(rejectingClaim.claimed_amount).toFixed(2)}</span> for{' '}
                <span className="font-bold text-white">{rejectingClaim.students?.name}</span>. No journal entry or cash balance update will occur.
              </p>

              <form onSubmit={handleInchargeConfirmReject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Optional Reason / Rejection Note:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="e.g. Payment transaction not found / Amount mismatch"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectingClaim(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={verifyingClaimId === rejectingClaim.id}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all"
                  >
                    {verifyingClaimId === rejectingClaim.id ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </InchargeAuthGuard>
  );
}
