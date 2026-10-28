import React from 'react';
import {
  LayoutDashboard,
  Bot,
  ArrowLeftRight,
  PieChart,
  Target,
  Repeat,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { NavigationTab } from '../types';
import { User } from 'firebase/auth';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unresolvedAnomaliesCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: User | null;
  onOpenGoogleSheets: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  unresolvedAnomaliesCount,
  collapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onOpenGoogleSheets,
}) => {
  const navItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'assistant' as NavigationTab,
      label: 'AI Assistant',
      icon: Bot,
      badge: 'Gemini 3.8',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    },
    {
      id: 'transactions' as NavigationTab,
      label: 'Transactions',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'budgets' as NavigationTab,
      label: 'Budgets',
      icon: PieChart,
      badge: null,
    },
    {
      id: 'goals' as NavigationTab,
      label: 'Goals',
      icon: Target,
      badge: null,
    },
    {
      id: 'recurring' as NavigationTab,
      label: 'Recurring Payments',
      icon: Repeat,
      badge: null,
    },
    {
      id: 'alerts' as NavigationTab,
      label: 'Alerts',
      icon: ShieldAlert,
      badge: unresolvedAnomaliesCount > 0 ? `${unresolvedAnomaliesCount}` : null,
      badgeColor: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings & Integrations',
      icon: Settings,
      badge: null,
    },
  ];

  const handleNavClick = (id: NavigationTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0d131f] border-r border-slate-800/80 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/70 h-16">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 shrink-0">
            <span className="font-bold text-sm tracking-tight">FP</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight truncate">FinPilot</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate">Decision Support</span>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Currency Context Pill */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-medium text-slate-300">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              INR Ledger (₹)
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Active" />
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {/* Left active line indicator */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />

              {!collapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                        item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Collapsed Badge Dot */}
              {collapsed && item.badge && (
                <span
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    item.id === 'alerts' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Google Sheets Sync Card at Bottom */}
      {!collapsed ? (
        <div className="p-3 border-t border-slate-800/70">
          <button
            onClick={onOpenGoogleSheets}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="text-[11px] font-semibold text-slate-200 truncate">Google Sheets</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {currentUser ? (currentUser.email || 'Connected') : 'Connect / Sync'}
                </div>
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                currentUser ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            />
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-slate-800/70 flex justify-center">
          <button
            onClick={onOpenGoogleSheets}
            title={currentUser ? `Google Sheets: ${currentUser.email}` : 'Google Sheets'}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-850 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 z-20 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`fixed top-0 bottom-0 left-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 z-50 md:hidden transform transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
