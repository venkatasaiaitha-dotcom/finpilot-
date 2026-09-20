import { Transaction, RecurringObligation, Budget, FinancialGoal } from '../types';

export interface SpreadsheetSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetMetadata {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

/**
 * List the user's Google Spreadsheets from Google Drive
 */
export async function listUserSpreadsheets(accessToken: string): Promise<SpreadsheetSummary[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to list spreadsheets (${response.status})`);
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
  }));
}

/**
 * Get spreadsheet details including all sheet/tab names
 */
export async function getSpreadsheetDetails(spreadsheetId: string, accessToken: string): Promise<{
  title: string;
  sheets: SheetMetadata[];
}> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch spreadsheet (${response.status})`);
  }

  const data = await response.json();
  const sheets: SheetMetadata[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title || 'Sheet1',
    rowCount: s.properties?.gridProperties?.rowCount || 0,
    columnCount: s.properties?.gridProperties?.columnCount || 0,
  }));

  return {
    title: data.properties?.title || 'Untitled Spreadsheet',
    sheets,
  };
}

/**
 * Read range values from a spreadsheet
 */
export async function readSheetValues(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<string[][]> {
  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to read sheet data (${response.status})`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Create a new comprehensive FinPilot Google Spreadsheet with structured tabs
 */
export async function exportFinPilotToNewSpreadsheet(
  title: string,
  accessToken: string,
  data: {
    transactions: Transaction[];
    obligations: RecurringObligation[];
    budgets: Budget[];
    goals: FinancialGoal[];
  }
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create spreadsheet with multiple tabs
  const createPayload = {
    properties: {
      title: title || `FinPilot Financial Report - ${new Date().toISOString().slice(0, 10)}`,
    },
    sheets: [
      { properties: { title: 'Transactions (INR)' } },
      { properties: { title: 'Category Budgets' } },
      { properties: { title: 'Recurring Obligations' } },
      { properties: { title: 'Financial Goals' } },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to create spreadsheet (${createRes.status})`);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Prepare tab values
  const txRows: any[][] = [
    ['Date', 'Merchant', 'Description', 'Amount (₹ INR)', 'Type', 'Category', 'Payment Method', 'Recurring?', 'Anomaly / Notes'],
    ...data.transactions.map((t) => [
      t.date,
      t.merchant,
      t.description || '',
      t.amount,
      t.type.toUpperCase(),
      t.category,
      t.paymentMethod || 'UPI / NetBanking',
      t.isRecurring ? `Yes (${t.recurringFrequency || 'monthly'})` : 'No',
      t.isAnomaly ? `ANOMALY: ${t.anomalyReason || 'Flagged'}` : '',
    ]),
  ];

  const budgetRows: any[][] = [
    ['Category', 'Monthly Limit (₹)', 'Spent So Far (₹)', 'Committed Upcoming (₹)', 'Remaining Balance (₹)', 'Status'],
    ...data.budgets.map((b) => {
      const remaining = b.monthlyLimit - (b.spent + (b.committedUpcoming || 0));
      const status = remaining < 0 ? 'OVER BUDGET' : remaining < b.monthlyLimit * 0.15 ? 'WARNING' : 'HEALTHY';
      return [b.category, b.monthlyLimit, b.spent, b.committedUpcoming || 0, remaining, status];
    }),
  ];

  const obligationRows: any[][] = [
    ['Name', 'Category', 'Amount (₹ INR)', 'Frequency', 'Next Due Date', 'Payment Method', 'Status', 'Is Subscription?'],
    ...data.obligations.map((o) => [
      o.name,
      o.category,
      o.amount,
      o.frequency,
      o.nextDueDate,
      o.paymentMethod || 'UPI / AutoPay',
      o.status,
      o.isSubscription ? 'Yes' : 'No',
    ]),
  ];

  const goalRows: any[][] = [
    ['Goal Name', 'Target Amount (₹)', 'Current Saved (₹)', 'Monthly Contribution (₹)', 'Target Date', 'Priority', 'Progress %'],
    ...data.goals.map((g) => {
      const progress = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
      return [g.name, g.targetAmount, g.currentAmount, g.monthlyContribution, g.targetDate, g.priority, `${progress}%`];
    }),
  ];

  // 3. Populate values in batch
  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: "'Transactions (INR)'!A1", values: txRows },
      { range: "'Category Budgets'!A1", values: budgetRows },
      { range: "'Recurring Obligations'!A1", values: obligationRows },
      { range: "'Financial Goals'!A1", values: goalRows },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateRes.ok) {
    const errorData = await updateRes.json().catch(() => ({}));
    console.warn('Initial data batch populate warning:', errorData);
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Overwrite or sync data to an existing spreadsheet with user confirmation
 */
export async function syncToExistingSpreadsheet(
  spreadsheetId: string,
  accessToken: string,
  data: {
    transactions: Transaction[];
    budgets: Budget[];
    obligations: RecurringObligation[];
    goals: FinancialGoal[];
  }
): Promise<void> {
  const txRows: any[][] = [
    ['Date', 'Merchant', 'Description', 'Amount (₹ INR)', 'Type', 'Category', 'Payment Method', 'Recurring?', 'Anomaly / Notes'],
    ...data.transactions.map((t) => [
      t.date,
      t.merchant,
      t.description || '',
      t.amount,
      t.type.toUpperCase(),
      t.category,
      t.paymentMethod || 'UPI / NetBanking',
      t.isRecurring ? `Yes (${t.recurringFrequency || 'monthly'})` : 'No',
      t.isAnomaly ? `ANOMALY: ${t.anomalyReason || 'Flagged'}` : '',
    ]),
  ];

  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: "'Transactions (INR)'!A1", values: txRows },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateRes.ok) {
    const errorData = await updateRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to update spreadsheet (${updateRes.status})`);
  }
}

/**
 * Helper to parse row arrays into FinPilot transactions
 */
export function parseSheetRowsToTransactions(rows: string[][]): {
  transactions: Transaction[];
  skippedRows: number;
} {
  if (!rows || rows.length < 2) {
    return { transactions: [], skippedRows: 0 };
  }

  const header = rows[0].map((h) => (h || '').toLowerCase().trim());

  // Find column indices
  let dateIdx = header.findIndex((h) => h.includes('date'));
  let merchantIdx = header.findIndex((h) => h.includes('merchant') || h.includes('name') || h.includes('payee') || h.includes('vendor'));
  let descIdx = header.findIndex((h) => h.includes('desc') || h.includes('detail') || h.includes('particular'));
  let amountIdx = header.findIndex((h) => h.includes('amount') || h.includes('debit') || h.includes('price') || h.includes('inr') || h.includes('rs') || h.includes('₹'));
  let typeIdx = header.findIndex((h) => h.includes('type'));
  let categoryIdx = header.findIndex((h) => h.includes('category'));
  let methodIdx = header.findIndex((h) => h.includes('method') || h.includes('account') || h.includes('mode'));

  if (dateIdx === -1) dateIdx = 0;
  if (merchantIdx === -1 && descIdx !== -1) merchantIdx = descIdx;
  if (merchantIdx === -1) merchantIdx = 1;
  if (amountIdx === -1) amountIdx = 2;

  const transactions: Transaction[] = [];
  let skippedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c || c.trim() === '')) {
      skippedRows++;
      continue;
    }

    const rawDate = row[dateIdx]?.trim() || new Date().toISOString().slice(0, 10);
    const merchant = row[merchantIdx]?.trim() || (descIdx !== -1 ? row[descIdx]?.trim() : 'Unknown Merchant') || 'General Expense';
    const description = descIdx !== -1 && row[descIdx] ? row[descIdx].trim() : merchant;

    // Parse amount: clean commas, ₹, Rs., etc.
    const rawAmountStr = (row[amountIdx] || '').replace(/[₹,$\sRs\.]/gi, (match) => (match === '.' ? '.' : ''));
    const amountNum = parseFloat(rawAmountStr);

    if (isNaN(amountNum) || amountNum <= 0) {
      skippedRows++;
      continue;
    }

    let type: 'income' | 'expense' = 'expense';
    if (typeIdx !== -1 && row[typeIdx]) {
      const tStr = row[typeIdx].toLowerCase();
      if (tStr.includes('income') || tStr.includes('credit') || tStr.includes('deposit')) {
        type = 'income';
      }
    } else {
      const lowerDesc = `${merchant} ${description}`.toLowerCase();
      if (lowerDesc.includes('salary') || lowerDesc.includes('freelance') || lowerDesc.includes('dividend') || lowerDesc.includes('refund')) {
        type = 'income';
      }
    }

    let category = 'Shopping & Goods';
    if (categoryIdx !== -1 && row[categoryIdx]) {
      category = row[categoryIdx].trim();
    } else if (type === 'income') {
      category = 'Income';
    } else {
      const l = `${merchant} ${description}`.toLowerCase();
      if (l.includes('rent') || l.includes('prestige') || l.includes('flat')) category = 'Housing & Rent';
      else if (l.includes('grocery') || l.includes('blinkit') || l.includes('zepto') || l.includes('supermarket')) category = 'Groceries';
      else if (l.includes('electricity') || l.includes('bescom') || l.includes('power') || l.includes('jio') || l.includes('wifi')) category = 'Utilities & Bills';
      else if (l.includes('swiggy') || l.includes('zomato') || l.includes('restaurant') || l.includes('cafe')) category = 'Dining & Takeout';
      else if (l.includes('fuel') || l.includes('petrol') || l.includes('uber') || l.includes('ola') || l.includes('service')) category = 'Transportation';
      else if (l.includes('netflix') || l.includes('spotify') || l.includes('prime') || l.includes('adobe')) category = 'Subscriptions & Digital';
      else if (l.includes('cult') || l.includes('gym') || l.includes('pharmacy') || l.includes('hospital')) category = 'Health & Fitness';
    }

    const paymentMethod = methodIdx !== -1 && row[methodIdx] ? row[methodIdx].trim() : 'Google Sheets Import';

    transactions.push({
      id: `gsheet-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      date: rawDate,
      merchant,
      description,
      amount: amountNum,
      type,
      category: category as any,
      paymentMethod,
    });
  }

  return { transactions, skippedRows };
}
