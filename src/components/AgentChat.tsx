import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User, RefreshCw, HelpCircle, ShieldCheck } from 'lucide-react';
import { ChatMessage, FinancialContextSnapshot } from '../types';

interface AgentChatProps {
  financialContext: FinancialContextSnapshot;
  initialPrompt?: string;
}

const DEFAULT_QUICK_QUESTIONS = [
  'Can I afford a ₹15,000 purchase next week?',
  'Where did I spend the most this month?',
  'Which subscriptions am I paying for?',
  'How much of my budget is already committed?',
  'How will buying a ₹20,000 gadget affect my goals?',
  'Summarize my upcoming bills in Rupees',
];

export const AgentChat: React.FC<AgentChatProps> = ({ financialContext, initialPrompt }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Hello! I am **FinPilot**, your Personal Finance Decision Support Agent.

All financial amounts are tracked in **Indian Rupees (₹)**. I can help you evaluate discretionary purchases, upcoming obligations, budget headroom, and goal impact.

Here are strategic decisions you can evaluate with me:
- **Can I afford a specific purchase?** (e.g. ₹15,000 gadget or ₹8,000 trip)
- **Where is my discretionary cash leaking?**
- **How much is already committed to subscriptions and bills?**
- **How will saving ₹2,000 more per month accelerate my Emergency Fund?**

Tap any prompt below or type your question in Rupees!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState(initialPrompt || '');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          financialContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || 'I processed your financial data in Rupees, but no output was returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: data.suggestedPrompts,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue connecting to the AI agent service (${err.message || 'Network error'}). Please try again or click one of the quick prompts above.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cells = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) {
          tableRows.push(cells);
        }
        return;
      } else if (inTable) {
        inTable = false;
        if (tableRows.length > 0) {
          const header = tableRows[0];
          const body = tableRows.slice(1);
          elements.push(
            <div key={`table-${index}`} className="my-3 overflow-x-auto border border-slate-800 rounded-xl">
              <table className="min-w-full text-xs divide-y divide-slate-800">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    {header.map((th, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold">
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
                  {body.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-[#111827]' : 'bg-slate-900/40'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-300">
                          {parseInlineFormatting(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          tableRows = [];
        }
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-sm font-bold text-white mt-3 mb-1.5 flex items-center gap-1.5">
            {trimmed.replace('### ', '')}
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={index} className="text-xs font-bold text-emerald-400 mt-2 mb-1">
            {trimmed.replace('#### ', '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-slate-300 my-1 pl-1">
            <span className="text-emerald-400 mt-0.5">•</span>
            <div>{parseInlineFormatting(trimmed.slice(2))}</div>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-slate-300 my-1 pl-1">
            <span className="font-semibold text-emerald-400 mt-0.5">{trimmed.slice(0, 2)}</span>
            <div>{parseInlineFormatting(trimmed.replace(/^\d+\.\s/, ''))}</div>
          </div>
        );
      } else if (trimmed.startsWith('💡') || trimmed.startsWith('⚠️')) {
        const isAlert = trimmed.startsWith('⚠️');
        elements.push(
          <div
            key={index}
            className={`my-2 p-3 rounded-xl border text-xs leading-relaxed ${
              isAlert
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            }`}
          >
            {parseInlineFormatting(trimmed)}
          </div>
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="text-xs text-slate-300 leading-relaxed my-1.5">
            {parseInlineFormatting(trimmed)}
          </p>
        );
      }
    });

    return elements;
  };

  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      id="finpilot-agent-chat"
      className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[calc(100vh-140px)] min-h-[580px] overflow-hidden"
    >
      {/* Agent Chat Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-[#0d131f] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">FinPilot Decision Support Agent</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Grounded in INR (₹)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluates purchase affordability, recurring obligations & cash flow
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: `reset-${Date.now()}`,
                role: 'assistant',
                content: 'Chat cleared. Ask me any question about your financial data in Rupees (₹)!',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
          title="Clear chat history"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/80 overflow-x-auto scrollbar-none flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Quick Ask:
        </span>
        {DEFAULT_QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="text-[11px] px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-emerald-500/15 text-slate-300 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 whitespace-nowrap transition-all shrink-0 font-medium cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0b0f17]">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs ${
                  isUser
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-emerald-400 border border-slate-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-slate-800 text-white font-medium border border-slate-700 shadow-sm'
                    : 'bg-[#111827] border border-slate-800 text-slate-200 shadow-sm'
                }`}
              >
                {isUser ? m.content : renderFormattedContent(m.content)}
                <div className={`text-[10px] mt-1.5 text-right ${isUser ? 'text-slate-400' : 'text-slate-500'}`}>
                  {m.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#111827] border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-xs text-slate-400 font-medium">FinPilot is synthesizing your finances in INR (₹)...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3.5 bg-[#0d131f] border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="agent-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask e.g. 'Can I afford ₹12,000 for a phone?' or 'How much is committed to bills?'"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
            disabled={loading}
          />
          <button
            id="agent-chat-submit-btn"
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/50 shrink-0 cursor-pointer"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
          <HelpCircle className="w-3 h-3 text-slate-500" />
          <span>Decision support agent for financial clarity. Not licensed fiduciary advisory.</span>
        </p>
      </div>
    </div>
  );
};
