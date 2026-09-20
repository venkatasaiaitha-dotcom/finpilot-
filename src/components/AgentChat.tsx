import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User, RefreshCw, HelpCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ChatMessage, FinancialContextSnapshot } from '../types';

interface AgentChatProps {
  financialContext: FinancialContextSnapshot;
}

const DEFAULT_QUICK_QUESTIONS = [
  'Where did I spend the most this month?',
  'Which subscriptions am I paying for?',
  'Can I afford a ₹15,000 purchase next week?',
  'How much can I save if I trim dining by ₹1,500/mo?',
  'How much of my budget is already committed?',
  'Summarize my upcoming bills in Rupees',
];

export const AgentChat: React.FC<AgentChatProps> = ({ financialContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Hello! I am **FinPilot**, your Personal Finance Decision Support Agent.

All financial amounts are tracked in **Indian Rupees (₹)**. I can help you understand your spending patterns, upcoming bills & subscriptions, cash flow buffer, and the impact on your savings goals.

Here are questions you can ask me:
- **Where did I spend the most this month?**
- **Which subscriptions or recurring bills am I paying for?**
- **Can I afford a ₹15,000 unplanned expense?**
- **How much of my budget is already committed?**

Tap any prompt below or type your question in Rupees!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
            <div key={`table-${index}`} className="my-3 overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    {header.map((th, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold">
                        {th}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {body.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-700">
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
          <h3 key={index} className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
            {trimmed.replace('### ', '')}
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={index} className="text-xs font-bold text-slate-800 mt-2 mb-1">
            {trimmed.replace('#### ', '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-slate-700 my-1 pl-1">
            <span className="text-slate-400 mt-0.5">•</span>
            <div>{parseInlineFormatting(trimmed.slice(2))}</div>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-slate-700 my-1 pl-1">
            <span className="font-semibold text-slate-900 mt-0.5">{trimmed.slice(0, 2)}</span>
            <div>{parseInlineFormatting(trimmed.replace(/^\d+\.\s/, ''))}</div>
          </div>
        );
      } else if (trimmed.startsWith('💡') || trimmed.startsWith('⚠️')) {
        const isAlert = trimmed.startsWith('⚠️');
        elements.push(
          <div
            key={index}
            className={`my-2 p-2.5 rounded-lg border text-xs ${
              isAlert ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}
          >
            {parseInlineFormatting(trimmed)}
          </div>
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="text-xs text-slate-700 leading-relaxed my-1.5">
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
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div id="finpilot-agent-chat" className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[680px] overflow-hidden">
      {/* Agent Chat Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">FinPilot Decision Support Copilot</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Grounded in INR (₹)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Ask any question about expenses, bills, commitments, or goals</p>
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
          className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-200/50 transition-colors"
          title="Clear chat history"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100 overflow-x-auto scrollbar-none flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Quick Ask:
        </span>
        {DEFAULT_QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 whitespace-nowrap transition-colors shrink-0 shadow-2xs font-medium cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/20">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  isUser ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-emerald-400'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                  isUser ? 'bg-indigo-600 text-white font-medium' : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {isUser ? m.content : renderFormattedContent(m.content)}
                <div className={`text-[10px] mt-1.5 text-right ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {m.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-xs text-slate-500 font-medium">FinPilot is synthesizing transactions in Rupees (₹)...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-100">
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
            placeholder="Ask e.g. 'Can I afford ₹15,000 for a new phone?' or 'Which subscriptions jumped in price?'"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            disabled={loading}
          />
          <button
            id="agent-chat-submit-btn"
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
          <HelpCircle className="w-3 h-3 text-slate-400" />
          <span>Decision support agent for financial clarity in INR. Not licensed investment or tax advice.</span>
        </p>
      </div>
    </div>
  );
};
