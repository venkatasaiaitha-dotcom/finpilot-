import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { googleSignIn, logout, getAccessToken } from '../services/googleAuth';
import {
  listUserSpreadsheets,
  getSpreadsheetDetails,
  readSheetValues,
  exportFinPilotToNewSpreadsheet,
  syncToExistingSpreadsheet,
  parseSheetRowsToTransactions,
  SpreadsheetSummary,
  SheetMetadata,
} from '../services/googleSheets';
import { Transaction, Budget, RecurringObligation, FinancialGoal } from '../types';
import { formatINR } from '../utils/currency';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onAuthChange: (user: User | null) => void;
  transactions: Transaction[];
  budgets: Budget[];
  obligations: RecurringObligation[];
  goals: FinancialGoal[];
  onImportTransactions: (txs: Transaction[]) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthChange,
  transactions,
  budgets,
  obligations,
  goals,
  onImportTransactions,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveSheets, setDriveSheets] = useState<SpreadsheetSummary[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Export State
  const [exportTitle, setExportTitle] = useState(
    `FinPilot Financial Ledger - ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [createdSheetUrl, setCreatedSheetUrl] = useState<string | null>(null);
  const [confirmOverwriteModal, setConfirmOverwriteModal] = useState<{
    isOpen: boolean;
    sheetId: string;
    sheetName: string;
  } | null>(null);

  // Import State
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [customSheetUrl, setCustomSheetUrl] = useState('');
  const [sheetTabs, setSheetTabs] = useState<SheetMetadata[]>([]);
  const [selectedTabName, setSelectedTabName] = useState<string>('');
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    transactions: Transaction[];
    skippedRows: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Load drive spreadsheets when user is authenticated
  useEffect(() => {
    if (isOpen && currentUser) {
      loadDriveFiles();
    }
  }, [isOpen, currentUser]);

  const loadDriveFiles = async () => {
    setIsLoadingDrive(true);
    setStatusMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStatusMessage({ type: 'info', text: 'Please sign in to access your Google Drive spreadsheets.' });
        return;
      }
      const files = await listUserSpreadsheets(token);
      setDriveSheets(files);
      if (files.length > 0 && !selectedSheetId) {
        setSelectedSheetId(files[0].id);
      }
    } catch (err: any) {
      console.error('Failed to list sheets:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to list spreadsheets from Google Drive.' });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onAuthChange(result.user);
        setStatusMessage({ type: 'success', text: `Connected as ${result.user.displayName || result.user.email}` });
        const token = result.accessToken;
        const files = await listUserSpreadsheets(token);
        setDriveSheets(files);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Google sign-in was canceled or failed.' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      onAuthChange(null);
      setDriveSheets([]);
      setCreatedSheetUrl(null);
      setParsedPreview(null);
      setStatusMessage({ type: 'info', text: 'Disconnected from Google account.' });
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Export handler
  const handleExportNew = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required. Please sign in with Google first.');

      const result = await exportFinPilotToNewSpreadsheet(exportTitle, token, {
        transactions,
        obligations,
        budgets,
        goals,
      });

      setCreatedSheetUrl(result.spreadsheetUrl);
      setStatusMessage({
        type: 'success',
        text: 'Successfully generated new Google Spreadsheet with all transactions, budgets, and goals!',
      });
      // Refresh drive files list
      loadDriveFiles();
    } catch (err: any) {
      console.error('Export error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export spreadsheet to Google Drive.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Sync to existing spreadsheet with explicit user confirmation
  const handleConfirmSyncExisting = async () => {
    if (!confirmOverwriteModal) return;
    const { sheetId } = confirmOverwriteModal;
    setConfirmOverwriteModal(null);
    setIsExporting(true);
    setStatusMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required.');

      await syncToExistingSpreadsheet(sheetId, token, {
        transactions,
        budgets,
        obligations,
        goals,
      });

      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${transactions.length} records to spreadsheet.`,
      });
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update existing spreadsheet.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch sheet tabs for import
  const handleFetchTabs = async (sheetId: string) => {
    if (!sheetId) return;
    setIsLoadingTabs(true);
    setSheetTabs([]);
    setParsedPreview(null);
    setStatusMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in with Google first.');

      const details = await getSpreadsheetDetails(sheetId, token);
      setSheetTabs(details.sheets);
      if (details.sheets.length > 0) {
        setSelectedTabName(details.sheets[0].title);
        handlePreviewSheet(sheetId, details.sheets[0].title);
      }
    } catch (err: any) {
      console.error('Tabs fetch error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Could not fetch tabs from this spreadsheet.' });
    } finally {
      setIsLoadingTabs(false);
    }
  };

  // Preview tab data
  const handlePreviewSheet = async (sheetId: string, tabName: string) => {
    if (!sheetId || !tabName) return;
    setStatusMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required.');

      const range = `'${tabName}'!A1:Z500`;
      const rows = await readSheetValues(sheetId, range, token);
      const parsed = parseSheetRowsToTransactions(rows);
      setParsedPreview(parsed);

      if (parsed.transactions.length === 0) {
        setStatusMessage({
          type: 'info',
          text: `Found ${rows.length} rows in "${tabName}", but could not find date or amount fields. Please verify headers.`,
        });
      }
    } catch (err: any) {
      console.error('Preview error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to read sheet values.' });
    }
  };

  // Final import into FinPilot
  const handleExecuteImport = () => {
    if (!parsedPreview || parsedPreview.transactions.length === 0) return;
    setIsImporting(true);
    try {
      onImportTransactions(parsedPreview.transactions);
      setStatusMessage({
        type: 'success',
        text: `Successfully imported ${parsedPreview.transactions.length} transactions into FinPilot!`,
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Import failed.' });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Google Sheets Integration
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Seamlessly export reports, backup cash flow, or import financial transactions with Google Workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Authentication Status Banner */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    className="w-7 h-7 rounded-full border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                    {currentUser.email?.charAt(0).toUpperCase() || 'G'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">
                      {currentUser.displayName || currentUser.email}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3" /> Connected
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{currentUser.email}</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <div>
                <p className="text-xs font-medium text-slate-800">Connect your Google Workspace Account</p>
                <p className="text-[11px] text-slate-500">
                  Enables creating and reading Google Sheets directly in your Google Drive with your permission.
                </p>
              </div>
              {/* Official Google Sign-In Button */}
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSigningIn ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 flex border-b border-slate-100 gap-6">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to Google Sheets</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import from Google Sheets</span>
          </button>
        </div>

        {/* Feedback Message */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-start gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {statusMessage.type === 'info' && <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  What will be exported
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Transactions</span>
                    <span className="font-bold text-slate-900">{transactions.length} records</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Category Budgets</span>
                    <span className="font-bold text-slate-900">{budgets.length} categories</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Obligations</span>
                    <span className="font-bold text-slate-900">{obligations.length} active</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Financial Goals</span>
                    <span className="font-bold text-slate-900">{goals.length} targets</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  placeholder="e.g. My Personal Finance Ledger"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleExportNew}
                  disabled={!currentUser || isExporting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Sheets in Google Drive...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Create New Spreadsheet in Google Drive</span>
                    </>
                  )}
                </button>
                {!currentUser && (
                  <p className="text-[11px] text-amber-600 text-center mt-1.5">
                    Sign in with Google above to enable export to your Drive.
                  </p>
                )}
              </div>

              {createdSheetUrl && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Spreadsheet Created Successfully!</span>
                    <span className="text-[11px] text-emerald-700">Ready to view and share in Google Sheets.</span>
                  </div>
                  <a
                    href={createdSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-2xs transition-colors"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Sync to Existing Spreadsheet Section */}
              {driveSheets.length > 0 && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>Or Sync to an Existing Spreadsheet</span>
                    <button
                      onClick={loadDriveFiles}
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Drive list
                    </button>
                  </h4>
                  <div className="space-y-2">
                    <select
                      value={selectedSheetId}
                      onChange={(e) => setSelectedSheetId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                    >
                      {driveSheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.modifiedTime?.slice(0, 10) || 'Recent'})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const target = driveSheets.find((s) => s.id === selectedSheetId);
                        setConfirmOverwriteModal({
                          isOpen: true,
                          sheetId: selectedSheetId,
                          sheetName: target?.name || 'Selected Spreadsheet',
                        });
                      }}
                      disabled={!selectedSheetId || isExporting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sync Data into this Spreadsheet</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Import from Google Sheets */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Spreadsheet from Google Drive
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedSheetId}
                    onChange={(e) => {
                      setSelectedSheetId(e.target.value);
                      handleFetchTabs(e.target.value);
                    }}
                    disabled={!currentUser || isLoadingDrive}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 disabled:opacity-50"
                  >
                    <option value="">-- Choose a spreadsheet --</option>
                    {driveSheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadDriveFiles}
                    disabled={!currentUser || isLoadingDrive}
                    title="Refresh Drive files"
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Or Paste Spreadsheet ID / URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or paste Spreadsheet ID / URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSheetUrl}
                    onChange={(e) => setCustomSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit or Sheet ID"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    onClick={() => {
                      let id = customSheetUrl.trim();
                      const match = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
                      if (match && match[1]) id = match[1];
                      setSelectedSheetId(id);
                      handleFetchTabs(id);
                    }}
                    disabled={!customSheetUrl.trim() || !currentUser}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
              </div>

              {/* Tab Selection */}
              {sheetTabs.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Sheet / Tab to Import
                  </label>
                  <select
                    value={selectedTabName}
                    onChange={(e) => {
                      setSelectedTabName(e.target.value);
                      handlePreviewSheet(selectedSheetId, e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                  >
                    {sheetTabs.map((t) => (
                      <option key={t.sheetId} value={t.title}>
                        {t.title} ({t.rowCount} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Parsed Preview */}
              {parsedPreview && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Parsed Transactions ({parsedPreview.transactions.length} detected)
                    </span>
                    {parsedPreview.skippedRows > 0 && (
                      <span className="text-[11px] text-slate-500">
                        {parsedPreview.skippedRows} non-transaction rows skipped
                      </span>
                    )}
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {parsedPreview.transactions.slice(0, 10).map((t) => (
                      <div key={t.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{t.merchant}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {t.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {t.date} • {t.description}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold ${
                            t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'}
                          {formatINR(t.amount)}
                        </span>
                      </div>
                    ))}
                    {parsedPreview.transactions.length > 10 && (
                      <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50/50">
                        + {parsedPreview.transactions.length - 10} more rows ready for import
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <button
                      onClick={handleExecuteImport}
                      disabled={parsedPreview.transactions.length === 0 || isImporting}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50"
                    >
                      {isImporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      <span>Import {parsedPreview.transactions.length} Transactions into FinPilot</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Destructive Confirmation Modal for Workspace Data Updates */}
        {confirmOverwriteModal?.isOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70">
            <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-600 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Confirm Spreadsheet Update</h3>
                  <span className="text-xs text-slate-500">Google Workspace Data Confirmation</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Are you sure you want to sync FinPilot records to{' '}
                <strong className="text-slate-900 font-semibold">{confirmOverwriteModal.sheetName}</strong>?
                This operation will update the transaction values in the spreadsheet with permission from your account.
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmOverwriteModal(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSyncExisting}
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs transition-colors"
                >
                  Confirm & Update Sheet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Google Drive & Sheets API (OAuth 2.0)</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
