'use client';

import { useEffect, useRef, useState } from 'react';

export interface ActivityEvent {
  id: number;
  type: 'llm_turn' | 'tool_start' | 'tool_complete' | 'reasoning' | 'agent_start' | 'agent_complete' | 'permission' | 'message';
  agent?: string;
  content: string;
  timestamp: number;
  duration?: number;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  llm_turn: { icon: '🧠', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', label: 'LLM' },
  reasoning: { icon: '💭', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', label: 'Thinking' },
  tool_start: { icon: '🔧', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Tool' },
  tool_complete: { icon: '✅', color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Done' },
  agent_start: { icon: '🤖', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Agent' },
  agent_complete: { icon: '🏁', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Agent' },
  permission: { icon: '🔐', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', label: 'Perm' },
  message: { icon: '💬', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Msg' },
};

function formatElapsed(startTime: number, eventTime: number): string {
  const elapsed = Math.round((eventTime - startTime) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
}

function EventRow({ event, startTime }: { event: ActivityEvent; startTime: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.message;
  const isLong = event.content.length > 120;

  return (
    <div
      className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => isLong && setExpanded(!expanded)}
    >
      <span className="text-xs text-gray-400 font-mono w-10 shrink-0 pt-0.5 text-right">
        {formatElapsed(startTime, event.timestamp)}
      </span>
      <span className="text-sm shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          {event.agent && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${config.bg}`}>
              {event.agent}
            </span>
          )}
          <span className={`text-xs ${config.color} ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {event.content}
          </span>
        </div>
      </div>
      {event.duration !== undefined && (
        <span className="text-xs text-gray-400 shrink-0">
          {event.duration > 1000 ? `${(event.duration / 1000).toFixed(1)}s` : `${event.duration}ms`}
        </span>
      )}
      {isLong && (
        <span className="text-xs text-gray-300 shrink-0">{expanded ? '▲' : '▼'}</span>
      )}
    </div>
  );
}

export function ActivityTimeline({ events, startTime }: { events: ActivityEvent[]; startTime: number }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (events.length === 0) return null;

  return (
    <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Timeline</span>
          <span className="text-xs text-gray-400">{events.length} events</span>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {events.map((event) => (
          <EventRow key={event.id} event={event} startTime={startTime} />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
