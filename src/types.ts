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
  paymentMethod: string; // e.g., 'Chase Sapphire', 'Bank Checking', 'Apple Pay'
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  isAnomaly?: boolean;
  anomalyReason?: string;
  confidence?: number; // 0 to 1
  tags?: string[];
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
}
