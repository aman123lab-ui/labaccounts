'use client';

import React, { useState, useEffect } from 'react';
import { getAdvancedDashboardMetrics, AdvancedDashboardMetrics } from '@/services/accountingService';
import { useRealtimeMultiSync } from '@/hooks/useRealtimeSync';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

function formatCurrency(val: number): React.ReactNode {
  const isNegative = val < 0;
  const abs = Math.abs(val).toFixed(2);
  return (
    <span className="inline-flex items-center gap-0.5">
      {isNegative && <span className="font-mono text-xs">-</span>}
      <span className="font-sans">₹</span>
      <span className="font-mono">{abs}</span>
    </span>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdvancedDashboardMetrics>({
    currentCash: 0,
    openingCash: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    studentOutstanding: 0,
    expenseCategories: [],
    revenueCategories: []
  });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'all-time'>('all-time');
  
  // Day View State (default today)
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  
  // Month View State (default current month/year)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const getPeriodRange = () => {
    if (filterMode === 'all-time') {
      return { start: '2000-01-01T00:00:00.000Z', end: '2099-12-31T23:59:59.999Z' };
    }
    
    if (filterMode === 'day') {
      return { 
        start: `${selectedDate}T00:00:00.000Z`, 
        end: `${selectedDate}T23:59:59.999Z` 
      };
    }
    
    if (filterMode === 'month') {
      // Create first day of month and last day of month in UTC
      const startObj = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0, 0));
      const endObj = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));
      
      return { 
        start: startObj.toISOString(), 
        end: endObj.toISOString() 
      };
    }

    return { start: '2000-01-01T00:00:00.000Z', end: '2099-12-31T23:59:59.999Z' };
  };

  const loadMetrics = async () => {
    setLoading(true);
    const { start, end } = getPeriodRange();
    const data = await getAdvancedDashboardMetrics(start, end);
    setMetrics(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, [filterMode, selectedDate, selectedMonth, selectedYear]);

  useRealtimeMultiSync({
    channelName: 'admin-dashboard-sync',
    tables: ['journal_entries', 'journal_entry_lines', 'payment_claims', 'cash_handover_claims', 'students'],
    onDataChange: () => {
      loadMetrics();
    },
  });

  const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b', '#ef4444', '#3b82f6'];

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* HEADER & FILTER CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Financial Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time accounting analytics and KPIs.</p>
        </div>
        
        {/* Dynamic Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {/* Contextual Date Selectors */}
          {filterMode === 'day' && (
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => {
                  const yest = new Date();
                  yest.setDate(yest.getDate() - 1);
                  setSelectedDate(yest.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Yesterday
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Today
              </button>
            </div>
          )}

          {filterMode === 'month' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const yr = new Date().getFullYear() - 5 + i;
                  return <option key={yr} value={yr}>{yr}</option>;
                })}
              </select>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setFilterMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'day'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'month'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all-time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'all-time'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All-Time
            </button>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Liquid Cash</span>
          <span className="text-lg font-black text-slate-900">
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.currentCash)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Opening Liquid Cash</span>
          <span className="text-lg font-black text-slate-900">
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.openingCash)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
          <span className="text-lg font-black text-slate-900">
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.totalRevenue)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</span>
          <span className="text-lg font-black text-slate-900">
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.totalExpenses)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
          <span className={`text-lg font-black ${metrics.netProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.netProfit)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm flex flex-col gap-1 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Student Outstanding</span>
          <span className="text-lg font-black text-slate-900">
             {loading ? <span className="animate-pulse bg-slate-200 h-6 w-20 rounded inline-block" /> : formatCurrency(metrics.studentOutstanding)}
          </span>
        </div>

      </div>

      {/* SIDE-BY-SIDE ANALYTICS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        
        {/* EXPENSE DONUT CHART (Card 1) */}
        <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-slate-900">Expense Distribution</h2>
            <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
              {formatCurrency(metrics.totalExpenses)} Total
            </div>
          </div>
          
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
               <span className="animate-pulse bg-slate-200 h-40 w-40 rounded-full" />
            </div>
          ) : metrics.expenseCategories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">
               No expenses recorded.
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="h-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.expenseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="amount"
                      nameKey="category"
                      stroke="none"
                    >
                      {metrics.expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                      itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                      labelStyle={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* LEGEND TABLE */}
              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 bg-white">
                      <th className="py-2.5 font-bold">Category</th>
                      <th className="py-2.5 text-right font-bold">Amount</th>
                      <th className="py-2.5 text-right font-bold w-12">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {metrics.expenseCategories.map((cat, i) => (
                      <tr key={cat.category} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 flex items-center gap-2.5 font-bold text-slate-700">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate max-w-[120px]" title={cat.category}>{cat.category}</span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(cat.amount)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-500">
                          {cat.percentage.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* REVENUE DONUT CHART (Card 2) */}
        <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-900">Revenue & Profit Sources</h2>
            <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
              {formatCurrency(metrics.totalRevenue)} Total
            </div>
          </div>

          {!loading && metrics.revenueCategories?.length > 0 && (
            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center gap-3 shrink-0">
              <span className="text-xl">🏆</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Top Source</span>
                <span className="text-xs font-black text-indigo-900">
                  {metrics.revenueCategories[0].category} ({metrics.revenueCategories[0].percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
               <span className="animate-pulse bg-slate-200 h-40 w-40 rounded-full" />
            </div>
          ) : metrics.revenueCategories?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">
               No revenue recorded.
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="h-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.revenueCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="amount"
                      nameKey="category"
                      stroke="none"
                    >
                      {metrics.revenueCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Amount']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                      itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                      labelStyle={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* LEGEND TABLE */}
              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 bg-white">
                      <th className="py-2.5 font-bold">Source</th>
                      <th className="py-2.5 text-right font-bold">Amount</th>
                      <th className="py-2.5 text-right font-bold w-12">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {metrics.revenueCategories.map((cat, i) => (
                      <tr key={cat.category} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 flex items-center gap-2.5 font-bold text-slate-700">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate max-w-[120px]" title={cat.category}>{cat.category}</span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(cat.amount)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-500">
                          {cat.percentage.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
