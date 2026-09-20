import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { StatCards } from './components/StatCards';
import { AgentChat } from './components/AgentChat';
import { BudgetManager } from './components/BudgetManager';
import { RecurringSubscriptions } from './components/RecurringSubscriptions';
import { AnomaliesAlerts } from './components/AnomaliesAlerts';
import { GoalImpactAnalyzer } from './components/GoalImpactAnalyzer';
import { TransactionLedger } from './components/TransactionLedger';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { StatementUploaderModal } from './components/StatementUploaderModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { initAuth } from './services/googleAuth';
import { User } from 'firebase/auth';

import {
  INITIAL_TRANSACTIONS,
  INITIAL_RECURRING_OBLIGATIONS,
  INITIAL_BUDGETS,
  INITIAL_GOALS,
  INITIAL_ANOMALIES,
  SAMPLE_INDIAN_DATASET,
} from './data/sampleFinancialData';

import {
  Transaction,
  RecurringObligation,
  Budget,
  FinancialGoal,
  SpendingAnomaly,
  Category,
  FinancialContextSnapshot,
} from './types';

// Helpers to ensure unique IDs across items
function sanitizeTransactionsList(txs: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return txs.map((t, idx) => {
    let id = t.id || `tx-${Date.now()}-${idx}`;
    if (seen.has(id)) {
      id = `${id}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    }
    seen.add(id);
    return { ...t, id };
  });
}

function sanitizeObligationsList(obs: RecurringObligation[]): RecurringObligation[] {
  const seen = new Set<string>();
  return obs.map((o, idx) => {
    let id = o.id || `rec-${Date.now()}-${idx}`;
    if (seen.has(id)) {
      id = `${id}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    }
    seen.add(id);
    return { ...o, id };
  });
}

export default function App() {
  // Local storage hydrated states - defaults to rich Indian sample data
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('finpilot_transactions_v2') || localStorage.getItem('finpilot_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeTransactionsList(parsed);
      } catch {}
    }
    return sanitizeTransactionsList(INITIAL_TRANSACTIONS);
  });

  const [obligations, setObligations] = useState<RecurringObligation[]>(() => {
    const saved = localStorage.getItem('finpilot_obligations_v2') || localStorage.getItem('finpilot_obligations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeObligationsList(parsed);
      } catch {}
    }
    return sanitizeObligationsList(INITIAL_RECURRING_OBLIGATIONS);
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('finpilot_budgets_v2') || localStorage.getItem('finpilot_budgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_BUDGETS;
  });

  const [goals, setGoals] = useState<FinancialGoal[]>(() => {
    const saved = localStorage.getItem('finpilot_goals_v2') || localStorage.getItem('finpilot_goals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_GOALS;
  });

  const [anomalies, setAnomalies] = useState<SpendingAnomaly[]>(() => {
    const saved = localStorage.getItem('finpilot_anomalies_v2') || localStorage.getItem('finpilot_anomalies');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_ANOMALIES;
  });

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize Firebase Auth listener for Google Workspace
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setCurrentUser(user),
      () => setCurrentUser(null)
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem('finpilot_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('finpilot_obligations', JSON.stringify(obligations));
  }, [obligations]);

  useEffect(() => {
    localStorage.setItem('finpilot_budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem('finpilot_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('finpilot_anomalies', JSON.stringify(anomalies));
  }, [anomalies]);

  // Dynamically determine the active month (e.g. '2026-09') from records or current date
  const activeMonthPrefix = useMemo(() => {
    if (transactions.length > 0) {
      const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].date.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  }, [transactions]);

  const monthDisplayName = useMemo(() => {
    try {
      const [year, month] = activeMonthPrefix.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return activeMonthPrefix;
    }
  }, [activeMonthPrefix]);

  // Current Month transactions
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(activeMonthPrefix));
  }, [transactions, activeMonthPrefix]);

  const totalIncome = useMemo(() => {
    return currentMonthTransactions
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [currentMonthTransactions]);

  const totalExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [currentMonthTransactions]);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? netSavings / totalIncome : 0;

  // Active subscriptions count and monthly total in ₹
  const activeSubscriptions = obligations.filter((o) => o.isSubscription && o.status !== 'canceled');
  const activeSubscriptionsMonthlyTotal = activeSubscriptions.reduce((acc, s) => {
    return acc + (s.frequency === 'monthly' ? s.amount : s.amount / 12);
  }, 0);

  // Upcoming bills in next 14 days
  const today = new Date();
  const upcomingBillsNext14Days = useMemo(() => {
    return obligations
      .filter((o) => o.status !== 'canceled')
      .filter((o) => {
        const d = new Date(o.nextDueDate);
        const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 14;
      })
      .reduce((acc, o) => acc + o.amount, 0);
  }, [obligations]);

  // Dynamically synchronize category spending into budgets
  const synchronizedBudgets = useMemo(() => {
    return budgets.map((b) => {
      const spent = currentMonthTransactions
        .filter((t) => t.type === 'expense' && t.category === b.category)
        .reduce((acc, t) => acc + t.amount, 0);
      const categoryUpcoming = obligations
        .filter((o) => o.status !== 'canceled' && o.category === b.category)
        .reduce((acc, o) => acc + o.amount, 0);
      return {
        ...b,
        spent,
        committedUpcoming: categoryUpcoming,
      };
    });
  }, [budgets, currentMonthTransactions, obligations]);

  const totalBudget = synchronizedBudgets.reduce((acc, b) => acc + b.monthlyLimit, 0);
  const spentSoFar = synchronizedBudgets.reduce((acc, b) => acc + b.spent, 0);
  const committedUpcoming = synchronizedBudgets.reduce((acc, b) => acc + b.committedUpcoming, 0);
  const unallocatedBuffer = Math.max(0, totalBudget - (spentSoFar + committedUpcoming));

  // Top expense categories breakdown
  const topExpenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of currentMonthTransactions) {
      if (t.type === 'expense') {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    }
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthTransactions]);

  // Financial snapshot for AI Agent context
  const financialContext: FinancialContextSnapshot = useMemo(() => {
    return {
      currentMonth: monthDisplayName,
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      transactionsCount: currentMonthTransactions.length,
      activeSubscriptionsCount: activeSubscriptions.length,
      activeSubscriptionsMonthlyTotal,
      upcomingBillsNext14Days,
      unresolvedAnomaliesCount: anomalies.filter((a) => !a.resolved).length,
      topExpenseCategories,
      budgetCommitment: {
        totalBudget,
        spentSoFar,
        committedUpcoming,
        unallocatedBuffer,
        percentCommitted: totalBudget > 0 ? ((spentSoFar + committedUpcoming) / totalBudget) * 100 : 0,
      },
      goalsProgress: goals.map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        percentComplete: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
        onTrack: g.priority === 'high',
        projectedCompletion: g.targetDate,
      })),
    };
  }, [
    monthDisplayName,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    currentMonthTransactions,
    activeSubscriptions,
    activeSubscriptionsMonthlyTotal,
    upcomingBillsNext14Days,
    anomalies,
    topExpenseCategories,
    totalBudget,
    spentSoFar,
    committedUpcoming,
    unallocatedBuffer,
    goals,
  ]);

  // Handlers
  const handleUpdateCategory = (txId: string, newCategory: Category) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
    );
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);

    // Check if recurring
    if (newTx.isRecurring) {
      setObligations((prev) => [
        {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: newTx.merchant,
          category: newTx.category,
          amount: newTx.amount,
          frequency: newTx.recurringFrequency || 'monthly',
          nextDueDate: '2026-10-15',
          status: 'active',
          paymentMethod: newTx.paymentMethod || 'UPI / Bank',
          isSubscription: newTx.category === 'Subscriptions & Digital',
        },
        ...prev,
      ]);
    }
  };

  const handleImportTransactions = (newTxs: Transaction[]) => {
    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const processed = newTxs.map((t, idx) => {
        let uniqueId = t.id || `imported-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        if (existingIds.has(uniqueId)) {
          uniqueId = `imported-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
        }
        existingIds.add(uniqueId);
        return { ...t, id: uniqueId };
      });
      return [...processed, ...prev];
    });
  };

  const handleUpdateBudget = (category: Category, newLimit: number) => {
    setBudgets((prev) =>
      prev.map((b) => (b.category === category ? { ...b, monthlyLimit: newLimit } : b))
    );
  };

  const handleAddBudgetCategory = (newBudget: Budget) => {
    setBudgets((prev) => {
      const exists = prev.some((b) => b.category === newBudget.category);
      if (exists) {
        return prev.map((b) => (b.category === newBudget.category ? newBudget : b));
      }
      return [...prev, newBudget];
    });
  };

  const handleAddObligation = (newObligation: RecurringObligation) => {
    const uniqueId = newObligation.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setObligations((prev) => [{ ...newObligation, id: uniqueId }, ...prev]);
  };

  const handleToggleObligationStatus = (id: string) => {
    setObligations((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const nextStatus =
          o.status === 'active' ? 'review_suggested' : o.status === 'review_suggested' ? 'canceled' : 'active';
        return { ...o, status: nextStatus };
      })
    );
  };

  const handleResolveAnomaly = (id: string) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
    );
  };

  const handleAddGoal = (goal: FinancialGoal) => {
    const uniqueId = goal.id || `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setGoals((prev) => [...prev, { ...goal, id: uniqueId }]);
  };

  // Complete wipe of all user data
  const handleWipeData = () => {
    setTransactions([]);
    setObligations([]);
    setBudgets([
      { category: 'Housing & Rent', monthlyLimit: 25000, spent: 0, committedUpcoming: 0, color: '#6366f1' },
      { category: 'Groceries', monthlyLimit: 12000, spent: 0, committedUpcoming: 0, color: '#10b981' },
      { category: 'Utilities & Bills', monthlyLimit: 5000, spent: 0, committedUpcoming: 0, color: '#f59e0b' },
      { category: 'Dining & Takeout', monthlyLimit: 6000, spent: 0, committedUpcoming: 0, color: '#ec4899' },
      { category: 'Transportation', monthlyLimit: 4000, spent: 0, committedUpcoming: 0, color: '#8b5cf6' },
      { category: 'Subscriptions & Digital', monthlyLimit: 2500, spent: 0, committedUpcoming: 0, color: '#3b82f6' },
    ]);
    setGoals([]);
    setAnomalies([]);
    localStorage.removeItem('finpilot_transactions');
    localStorage.removeItem('finpilot_transactions_v2');
    localStorage.removeItem('finpilot_obligations');
    localStorage.removeItem('finpilot_obligations_v2');
    localStorage.removeItem('finpilot_budgets');
    localStorage.removeItem('finpilot_budgets_v2');
    localStorage.removeItem('finpilot_goals');
    localStorage.removeItem('finpilot_goals_v2');
    localStorage.removeItem('finpilot_anomalies');
    localStorage.removeItem('finpilot_anomalies_v2');
    localStorage.setItem('finpilot_user_cleared', 'true');
  };

  // 1-click loading / resetting of the Indian Rupees sample dataset
  const handleLoadSampleData = () => {
    localStorage.removeItem('finpilot_user_cleared');
    setTransactions(SAMPLE_INDIAN_DATASET.transactions);
    setObligations(SAMPLE_INDIAN_DATASET.obligations);
    setBudgets(INITIAL_BUDGETS);
    setGoals(SAMPLE_INDIAN_DATASET.goals);
    setAnomalies(SAMPLE_INDIAN_DATASET.anomalies);
    localStorage.setItem('finpilot_transactions', JSON.stringify(SAMPLE_INDIAN_DATASET.transactions));
    localStorage.setItem('finpilot_obligations', JSON.stringify(SAMPLE_INDIAN_DATASET.obligations));
    localStorage.setItem('finpilot_budgets', JSON.stringify(INITIAL_BUDGETS));
    localStorage.setItem('finpilot_goals', JSON.stringify(SAMPLE_INDIAN_DATASET.goals));
    localStorage.setItem('finpilot_anomalies', JSON.stringify(SAMPLE_INDIAN_DATASET.anomalies));
  };

  const hasData = transactions.length > 0 || obligations.length > 0 || goals.length > 0;

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Global Application Header */}
      <Header
        currentMonth={monthDisplayName}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenSummary={() => setIsSummaryModalOpen(true)}
        onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        onOpenAddTransaction={() => {
          const el = document.getElementById('transactions-ledger-card');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onWipeData={handleWipeData}
        onLoadSampleData={handleLoadSampleData}
        unresolvedAnomaliesCount={anomalies.filter((a) => !a.resolved).length}
        hasData={hasData}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Top-Level Stat Cards in Rupees */}
        <StatCards
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          netSavings={netSavings}
          savingsRate={savingsRate}
          committedUpcoming={committedUpcoming}
          unallocatedBuffer={unallocatedBuffer}
          expenseChangePercent={0}
          activeSubscriptionsMonthlyTotal={activeSubscriptionsMonthlyTotal}
        />

        {/* Anomalies Banner */}
        <AnomaliesAlerts anomalies={anomalies} onResolveAnomaly={handleResolveAnomaly} />

        {/* Two-Column Grid: Left Column = AI Agent & Budget; Right Column = Goals & Subscriptions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: FinPilot Agent Chat (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <AgentChat financialContext={financialContext} />
            <BudgetManager
              budgets={synchronizedBudgets}
              onUpdateBudget={handleUpdateBudget}
              onAddCategory={handleAddBudgetCategory}
            />
          </div>

          {/* Right Column: Goal Impact Simulator & Subscriptions (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <GoalImpactAnalyzer
              goals={goals}
              onAddGoal={handleAddGoal}
              monthlyDiscretionarySpend={topExpenseCategories
                .filter((c) => c.category === 'Dining & Takeout' || c.category === 'Shopping & Goods')
                .reduce((a, b) => a + b.amount, 0)}
              netSavings={netSavings}
            />

            <RecurringSubscriptions
              obligations={obligations}
              onToggleStatus={handleToggleObligationStatus}
              onAddObligation={handleAddObligation}
            />
          </div>
        </div>

        {/* Full Transaction Ledger */}
        <TransactionLedger
          transactions={transactions}
          onUpdateCategory={handleUpdateCategory}
          onAddTransaction={handleAddTransaction}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">FinPilot</span>
            <span>•</span>
            <span>Personal Finance Decision Support Agent (INR ₹)</span>
            <span>•</span>
            <span>Powered by Gemini 3.8 Flash</span>
          </div>
          <div>
            <span>Analytical decision support agent. Not financial or legal advisory.</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StatementUploaderModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportTransactions={handleImportTransactions}
      />

      <MonthlySummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        financialContext={financialContext}
      />

      <GoogleSheetsModal
        isOpen={isGoogleSheetsOpen}
        onClose={() => setIsGoogleSheetsOpen(false)}
        currentUser={currentUser}
        onAuthChange={(user) => setCurrentUser(user)}
        transactions={transactions}
        budgets={budgets}
        obligations={obligations}
        goals={goals}
        onImportTransactions={handleImportTransactions}
      />
    </div>
  );
}
