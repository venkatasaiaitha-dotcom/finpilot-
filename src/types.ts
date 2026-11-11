export type TransactionType = 'expense' | 'income' | 'transfer';

export type Category =
  | 'Housing & Rent'
  | 'Utilities & Bills'
  | 'Groceries'
  | 'Dining & Takeout'
  | 'Transportation'
  | 'Subscriptions & Digital'
  | 'Shopping & Goods'
  | 'Health & Fitness'
  | 'Entertainment'
  | 'Travel'
  | 'Income'
  | 'Education & Learning'
  | 'Financial & Savings'
  | 'Other Expenses';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  description?: string;
  amount: number; // positive for expenses, positive for income with type='income'
  type: TransactionType;
  category: Category;
  paymentMethod: string; // e.g., 'PayPal Sandbox', 'UPI / HDFC'
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  isAnomaly?: boolean;
  anomalyReason?: string;
  confidence?: number; // 0 to 1
  tags?: string[];
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalTransactionId?: string;
  paypalSubscriptionId?: string;
  usdAmount?: number;
}

export interface Budget {
  category: Category;
  monthlyLimit: number;
  spent: number;
  committedUpcoming: number;
  icon?: string;
  color: string;
}

export interface RecurringObligation {
  id: string;
  name: string;
  category: Category;
  amount: number;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  nextDueDate: string; // YYYY-MM-DD
  status: 'active' | 'review_suggested' | 'canceled';
  paymentMethod: string;
  isSubscription: boolean;
  notes?: string;
  priceChangeAlert?: {
    oldAmount: number;
    newAmount: number;
    difference: number;
    dateDetected: string;
  };
  paypalSubscriptionId?: string;
  paypalPlanId?: string;
  paypalStatus?: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  monthlyContribution: number;
  category: 'emergency' | 'travel' | 'purchase' | 'debt' | 'savings';
  priority: 'high' | 'medium' | 'low';
  icon?: string;
  notes?: string;
}

export interface SpendingAnomaly {
  id: string;
  transactionId?: string;
  merchant: string;
  amount: number;
  date: string;
  type: 'unusual_spike' | 'duplicate_charge' | 'price_increase' | 'unusual_category' | 'frequent_charges';
  category?: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionRecommendation: string;
  resolved: boolean;
}

export interface MonthlyFinancialSummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number; // e.g. 28%
  prevMonthExpenses: number;
  expenseChangePercent: number;
  committedObligationsTotal: number;
  remainingDiscretionary: number;
  cashFlowStatus: 'healthy' | 'moderate' | 'stretched';
  topCategories: {
    category: Category;
    amount: number;
    percentage: number;
    changeVsLastMonth: number;
  }[];
  keyObservations: string[];
  actionItems: {
    id: string;
    title: string;
    impact: string;
    potentialSavings: number;
    category: Category;
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedPrompts?: string[];
  metadata?: {
    highlightCategory?: string;
    actionableInsight?: string;
    metricPill?: string;
  };
}

export interface PayPalStatusResponse {
  connected: boolean;
  mode: 'sandbox';
  clientId: string | null;
  source: 'env' | 'session' | 'none';
  appId?: string;
  scopes?: string[];
  hasTransactionSearchScope?: boolean;
  inrPerUsd: number;
  tokenExpiresAt?: string;
  lastError?: string | null;
}

export interface PayPalOrderRecord {
  orderId: string;
  status: string;
  purpose: 'purchase' | 'goal_funding';
  title: string;
  amountINR: number;
  amountUSD: string;
  category: Category;
  goalId?: string;
  approveUrl?: string;
  captureId?: string;
  payerEmail?: string;
  aiVerdict?: 'healthy' | 'caution' | 'stretched';
  aiReasoning?: string;
  createdAt: string;
  capturedAt?: string;
}

export interface PayPalSubscriptionRecord {
  subscriptionId: string;
  planId: string;
  productId: string;
  name: string;
  amountINR: number;
  amountUSD: string;
  frequency: 'monthly' | 'yearly';
  status: string;
  approveUrl?: string;
  goalId?: string;
  createdAt: string;
}

export interface PayPalWalletBalance {
  currency: string;
  totalValue: string;
  availableValue: string;
  withheldValue: string;
}

export interface PayPalApiLogEntry {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  endpoint: string;
  statusCode: number;
  summary: string;
  durationMs: number;
}

export interface FinancialContextSnapshot {
  currentMonth: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  transactionsCount: number;
  activeSubscriptionsCount: number;
  activeSubscriptionsMonthlyTotal: number;
  upcomingBillsNext14Days: number;
  unresolvedAnomaliesCount: number;
  topExpenseCategories: { category: string; amount: number }[];
  budgetCommitment: {
    totalBudget: number;
    spentSoFar: number;
    committedUpcoming: number;
    unallocatedBuffer: number;
    percentCommitted: number;
  };
  goalsProgress: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    percentComplete: number;
    onTrack: boolean;
    projectedCompletion: string;
  }[];
  paypalContext?: {
    connected: boolean;
    inrPerUsd: number;
    capturedOrdersCount: number;
    totalCapturedUSD: number;
    activePaypalSubscriptionsCount: number;
    sandboxBalances?: PayPalWalletBalance[];
  };
}

export type NavigationTab =
  | 'overview'
  | 'assistant'
  | 'paypal'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'recurring'
  | 'alerts'
  | 'settings';
