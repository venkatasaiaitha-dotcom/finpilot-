import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/views/OverviewView';
import { SettingsView } from './components/views/SettingsView';
import { PayPalHubView } from './components/views/PayPalHubView';
import { AgentChat } from './components/AgentChat';
import { BudgetManager } from './components/BudgetManager';
import { RecurringSubscriptions } from './components/RecurringSubscriptions';
import { AnomaliesAlerts } from './components/AnomaliesAlerts';
import { GoalImpactAnalyzer } from './components/GoalImpactAnalyzer';
import { TransactionLedger } from './components/TransactionLedger';
import { AnalyzePurchaseModal } from './components/AnalyzePurchaseModal';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { StatementUploaderModal } from './components/StatementUploaderModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { initAuth } from './services/googleAuth';
import { User } from 'firebase/auth';
import {
  PayPalFullState,
  getPayPalStatus,
  getPayPalOrder,
  capturePayPalOrder,
  refreshPayPalSubscription,
  cancelPayPalSubscription,
  syncPayPalSandbox,
} from './services/paypalApi';

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
  NavigationTab,
  PayPalStatusResponse,
  PayPalOrderRecord,
  PayPalSubscriptionRecord,
  PayPalWalletBalance,
  PayPalApiLogEntry,
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
  // Navigation & Layout states
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | undefined>(undefined);

  // Local storage hydrated states
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
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // PayPal Sandbox states
  const [paypalStatus, setPaypalStatus] = useState<PayPalStatusResponse | null>(null);
  const [paypalOrders, setPaypalOrders] = useState<PayPalOrderRecord[]>([]);
  const [paypalSubscriptions, setPaypalSubscriptions] = useState<PayPalSubscriptionRecord[]>([]);
  const [paypalBalances, setPaypalBalances] = useState<PayPalWalletBalance[]>([]);
  const [paypalApiLogs, setPaypalApiLogs] = useState<PayPalApiLogEntry[]>([]);
  const [paypalScopeWarning, setPaypalScopeWarning] = useState<string | undefined>(undefined);

  const applyPayPalFullState = (state: PayPalFullState) => {
    setPaypalStatus({
      connected: state.connected,
      mode: state.mode,
      clientId: state.clientId,
      source: state.source,
      appId: state.appId,
      scopes: state.scopes,
      hasTransactionSearchScope: state.hasTransactionSearchScope,
      inrPerUsd: state.inrPerUsd,
      tokenExpiresAt: state.tokenExpiresAt,
      lastError: state.lastError,
    });
    setPaypalOrders(state.orders || []);
    setPaypalSubscriptions(state.subscriptions || []);
    setPaypalApiLogs(state.apiLogs || []);
  };

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
    const capturedOrders = paypalOrders.filter((o) => o.status === 'COMPLETED');
    const totalCapturedUSD = capturedOrders.reduce(
      (acc, o) => acc + (Number(o.amountUSD) || 0),
      0
    );
    const activePaypalSubs = paypalSubscriptions.filter(
      (s) => s.status === 'ACTIVE'
    ).length;

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
      paypalContext: {
        connected: Boolean(paypalStatus?.connected),
        inrPerUsd: paypalStatus?.inrPerUsd || 84.5,
        capturedOrdersCount: capturedOrders.length,
        totalCapturedUSD,
        activePaypalSubscriptionsCount: activePaypalSubs,
        sandboxBalances: paypalBalances.length > 0 ? paypalBalances : undefined,
      },
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
    paypalStatus,
    paypalOrders,
    paypalSubscriptions,
    paypalBalances,
  ]);

  // Handlers
  const handleUpdateCategory = (txId: string, newCategory: Category) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
    );
  };

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions((prev) => [newTx, ...prev]);

    if (newTx.isRecurring) {
      setObligations((prev) => [
        {
          id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: newTx.merchant,
          category: newTx.category,
          amount: newTx.amount,
          frequency: newTx.recurringFrequency || 'monthly',
          nextDueDate: '2026-11-15',
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

  // PayPal Sandbox Integration Handlers
  const upsertPayPalSubscriptionObligation = (sub: PayPalSubscriptionRecord) => {
    setObligations((prev) => {
      const existingIdx = prev.findIndex((o) => o.paypalSubscriptionId === sub.subscriptionId);
      const mappedStatus: RecurringObligation['status'] =
        sub.status === 'CANCELLED' || sub.status === 'EXPIRED' ? 'canceled' : 'active';

      if (existingIdx >= 0) {
        return prev.map((o, idx) =>
          idx === existingIdx
            ? {
                ...o,
                status: mappedStatus,
                paypalStatus: sub.status,
              }
            : o
        );
      }

      if (sub.status !== 'ACTIVE' && sub.status !== 'APPROVAL_PENDING') {
        return prev;
      }

      const nextDue = new Date();
      if (sub.frequency === 'yearly') {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      } else {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }

      const newObligation: RecurringObligation = {
        id: `pp-sub-${sub.subscriptionId}`,
        name: sub.name,
        category: sub.goalId ? 'Financial & Savings' : 'Subscriptions & Digital',
        amount: sub.amountINR,
        frequency: sub.frequency,
        nextDueDate: nextDue.toISOString().slice(0, 10),
        status: mappedStatus,
        paymentMethod: 'PayPal Auto-Pay',
        isSubscription: !sub.goalId,
        paypalSubscriptionId: sub.subscriptionId,
        paypalPlanId: sub.planId,
        paypalStatus: sub.status,
      };
      return [newObligation, ...prev];
    });
  };

  const handlePayPalPaymentCaptured = (order: PayPalOrderRecord) => {
    if (!order || order.status !== 'COMPLETED') return;

    const txDate = (order.capturedAt || order.createdAt || new Date().toISOString()).slice(0, 10);
    const txId = `pp-order-${order.captureId || order.orderId}`;

    setTransactions((prev) => {
      const alreadyLogged = prev.some(
        (t) =>
          t.id === txId ||
          t.paypalOrderId === order.orderId ||
          (order.captureId && t.paypalCaptureId === order.captureId)
      );
      if (alreadyLogged) return prev;

      const newTx: Transaction = {
        id: txId,
        date: txDate,
        merchant:
          order.purpose === 'goal_funding'
            ? `Goal Deposit: ${order.title}`
            : order.title,
        category:
          order.category ||
          (order.purpose === 'goal_funding' ? 'Financial & Savings' : 'Shopping & Goods'),
        amount: Math.max(1, Math.round(order.amountINR)),
        usdAmount: Number(order.amountUSD) || undefined,
        type: 'expense',
        description: `PayPal Sandbox Capture ${order.captureId || order.orderId}${
          order.payerEmail ? ` • ${order.payerEmail}` : ''
        }`,
        paymentMethod: 'PayPal Sandbox',
        paypalOrderId: order.orderId,
        paypalCaptureId: order.captureId,
      };

      return [newTx, ...prev];
    });

    if (order.purpose === 'goal_funding' && order.goalId) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === order.goalId
            ? { ...g, currentAmount: g.currentAmount + Math.round(order.amountINR) }
            : g
        )
      );
    }
  };

  const handleSyncPayPal = async () => {
    const result = await syncPayPalSandbox(30);
    setPaypalBalances(result.balances || []);
    setPaypalScopeWarning(result.scopeWarning);
    setPaypalOrders(result.orders || []);
    setPaypalSubscriptions(result.subscriptions || []);
    setPaypalApiLogs(result.apiLogs || []);

    if (result.transactions && result.transactions.length > 0) {
      setTransactions((prev) => {
        const existingTxIds = new Set(
          prev
            .flatMap((t) => [t.id, t.paypalTransactionId, t.paypalCaptureId])
            .filter(Boolean) as string[]
        );
        const fresh = result.transactions.filter(
          (incoming) =>
            !existingTxIds.has(incoming.id) &&
            !(incoming.paypalTransactionId && existingTxIds.has(incoming.paypalTransactionId))
        );
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
    }
  };

  const handleRefreshPayPalSubscription = async (subscriptionId: string) => {
    const res = await refreshPayPalSubscription(subscriptionId);
    setPaypalSubscriptions(res.subscriptions || []);
    setPaypalApiLogs(res.apiLogs || []);
    upsertPayPalSubscriptionObligation(res.subscription);
  };

  const handleCancelPayPalSubscription = async (subscriptionId: string) => {
    const res = await cancelPayPalSubscription(subscriptionId, 'Canceled from FinPilot dashboard');
    setPaypalSubscriptions(res.subscriptions || []);
    setPaypalApiLogs(res.apiLogs || []);
    upsertPayPalSubscriptionObligation(res.subscription);
  };

  // Load PayPal Sandbox status & handle OAuth/Checkout/Subscription return redirects
  useEffect(() => {
    let mounted = true;

    const initPayPal = async () => {
      try {
        const state = await getPayPalStatus();
        if (!mounted) return;
        applyPayPalFullState(state);

        const params = new URLSearchParams(window.location.search);
        const returnType = params.get('paypal_return');
        const token = params.get('token');
        const subId = params.get('subscription_id');

        if (returnType) {
          setActiveTab('paypal');

          if (returnType === 'order' && token) {
            try {
              const details = await getPayPalOrder(token);
              if (details.order.status === 'APPROVED') {
                const captured = await capturePayPalOrder(token);
                if (!mounted) return;
                setPaypalOrders(captured.orders || []);
                setPaypalApiLogs(captured.apiLogs || []);
                handlePayPalPaymentCaptured(captured.order);
              } else if (details.order.status === 'COMPLETED') {
                if (!mounted) return;
                setPaypalOrders(details.orders || []);
                setPaypalApiLogs(details.apiLogs || []);
                handlePayPalPaymentCaptured(details.order);
              }
            } catch (err) {
              console.error('PayPal return order completion error:', err);
            }
          } else if (returnType === 'subscription' && subId) {
            try {
              const subRes = await refreshPayPalSubscription(subId);
              if (!mounted) return;
              setPaypalSubscriptions(subRes.subscriptions || []);
              setPaypalApiLogs(subRes.apiLogs || []);
              upsertPayPalSubscriptionObligation(subRes.subscription);
            } catch (err) {
              console.error('PayPal return subscription sync error:', err);
            }
          }

          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {
        // Backend still booting or PayPal status unavailable; ignored safely
      }
    };

    initPayPal();
    return () => {
      mounted = false;
    };
  }, []);

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
  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-row font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setAssistantPrompt(undefined);
        }}
        unresolvedAnomaliesCount={unresolvedCount}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        currentUser={currentUser}
        onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
        paypalConnected={Boolean(paypalStatus?.connected)}
      />

      {/* 2. Main Content View Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          currentMonth={monthDisplayName}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenSummary={() => setIsSummaryModalOpen(true)}
          onOpenAddTransaction={() => {
            setActiveTab('transactions');
          }}
          onAnalyzePurchase={() => setIsAnalyzeModalOpen(true)}
          unresolvedAnomaliesCount={unresolvedCount}
          onNavigateToAlerts={() => setActiveTab('alerts')}
          paypalConnected={Boolean(paypalStatus?.connected)}
          onNavigateToPayPal={() => setActiveTab('paypal')}
        />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              netSavings={netSavings}
              savingsRate={savingsRate}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalBudget={totalBudget}
              spentSoFar={spentSoFar}
              committedUpcoming={committedUpcoming}
              unallocatedBuffer={unallocatedBuffer}
              recentTransactions={transactions}
              financialContext={financialContext}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onAnalyzePurchase={() => setIsAnalyzeModalOpen(true)}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onOpenAddTransaction={() => setActiveTab('transactions')}
            />
          )}

          {activeTab === 'assistant' && (
            <AgentChat
              financialContext={financialContext}
              initialPrompt={assistantPrompt}
            />
          )}

          {activeTab === 'paypal' && (
            <PayPalHubView
              paypalStatus={paypalStatus}
              orders={paypalOrders}
              subscriptions={paypalSubscriptions}
              balances={paypalBalances}
              apiLogs={paypalApiLogs}
              scopeWarning={paypalScopeWarning}
              goals={goals}
              financialContext={financialContext}
              onStatusUpdated={(status, updatedOrders, updatedSubs, updatedLogs) => {
                setPaypalStatus(status);
                setPaypalOrders(updatedOrders);
                setPaypalSubscriptions(updatedSubs);
                setPaypalApiLogs(updatedLogs);
              }}
              onOrderActivity={(updatedOrders, updatedLogs) => {
                setPaypalOrders(updatedOrders);
                setPaypalApiLogs(updatedLogs);
              }}
              onSubscriptionActivity={(updatedSubs, updatedLogs) => {
                setPaypalSubscriptions(updatedSubs);
                setPaypalApiLogs(updatedLogs);
                updatedSubs.forEach((sub) => upsertPayPalSubscriptionObligation(sub));
              }}
              onSyncPayPal={handleSyncPayPal}
              onPaymentCaptured={handlePayPalPaymentCaptured}
              onOpenSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionLedger
              transactions={transactions}
              onUpdateCategory={handleUpdateCategory}
              onAddTransaction={handleAddTransaction}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
              onSyncPayPal={handleSyncPayPal}
              paypalConnected={Boolean(paypalStatus?.connected)}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetManager
              budgets={synchronizedBudgets}
              onUpdateBudget={handleUpdateBudget}
              onAddCategory={handleAddBudgetCategory}
            />
          )}

          {activeTab === 'goals' && (
            <GoalImpactAnalyzer
              goals={goals}
              onAddGoal={handleAddGoal}
              monthlyDiscretionarySpend={topExpenseCategories
                .filter((c) => c.category === 'Dining & Takeout' || c.category === 'Shopping & Goods')
                .reduce((a, b) => a + b.amount, 0)}
              netSavings={netSavings}
              paypalStatus={paypalStatus}
              onOrderActivity={(updatedOrders, updatedLogs) => {
                setPaypalOrders(updatedOrders);
                setPaypalApiLogs(updatedLogs);
              }}
              onPaymentCaptured={handlePayPalPaymentCaptured}
              onOpenPayPalSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'recurring' && (
            <RecurringSubscriptions
              obligations={obligations}
              onToggleStatus={handleToggleObligationStatus}
              onAddObligation={handleAddObligation}
              onManagePayPalSubscriptions={() => setActiveTab('paypal')}
              onRefreshPayPalSubscription={handleRefreshPayPalSubscription}
              onCancelPayPalSubscription={handleCancelPayPalSubscription}
            />
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <AnomaliesAlerts
                anomalies={anomalies}
                onResolveAnomaly={handleResolveAnomaly}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onOpenGoogleSheets={() => setIsGoogleSheetsOpen(true)}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onLoadSampleData={handleLoadSampleData}
              onWipeData={handleWipeData}
              hasData={hasData}
              paypalStatus={paypalStatus}
              onPayPalStatusUpdated={applyPayPalFullState}
              onNavigateToPayPalHub={() => setActiveTab('paypal')}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-800/80 bg-[#0d131f] py-4 px-4 sm:px-8 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300">FinPilot</span>
              <span>•</span>
              <span>Personal Finance Decision Support Agent (INR ₹)</span>
              <span>•</span>
              <span className="text-emerald-400">Gemini 3.8 Flash</span>
            </div>
            <div>
              <span>Analytical decision intelligence. Not registered fiduciary or legal advisory.</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <AnalyzePurchaseModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        financialContext={financialContext}
        onNavigateToAssistant={(prompt) => {
          setAssistantPrompt(prompt);
          setActiveTab('assistant');
        }}
        paypalStatus={paypalStatus}
        onOrderActivity={(updatedOrders, updatedLogs) => {
          setPaypalOrders(updatedOrders);
          setPaypalApiLogs(updatedLogs);
        }}
        onPaymentCaptured={handlePayPalPaymentCaptured}
        onOpenPayPalSettings={() => setActiveTab('settings')}
      />

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
