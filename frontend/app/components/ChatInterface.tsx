'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RepositorySelector } from './RepositorySelector';
import { MessageList } from './MessageList';
import { ActivityTimeline, ActivityEvent } from './ActivityTimeline';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatInterface({ user }: { user: any }) {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('auto');
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [requestStartTime, setRequestStartTime] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventIdRef = useRef(0);
  // Track active tool calls to compute duration
  const toolStartTimesRef = useRef<Map<string, number>>(new Map());
  // Track tool names by toolCallId for completion lookup
  const toolNamesRef = useRef<Map<string, string>>(new Map());
  // Track current agent stack
  const activeAgentsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    fetch('/api/repositories', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.repositories && data.repositories.length > 0) {
          setRepositories(data.repositories);
          setSelectedRepo(data.repositories[0].name);
        }
      })
      .catch((error) => {
        console.error('Error loading repositories:', error);
      });

    fetch('/api/agents', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.agents) {
          setAgents(data.agents);
        }
      })
      .catch((error) => {
        console.error('Error loading agents:', error);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activityEvents]);

  const addActivity = useCallback((type: ActivityEvent['type'], content: string, agent?: string, duration?: number) => {
    const id = ++eventIdRef.current;
    setActivityEvents((prev) => [
      ...prev,
      { id, type, content, agent, timestamp: Date.now(), duration },
    ]);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  };

  const askQuestion = async () => {
    if (!question.trim() || !selectedRepo) return;

    const currentQuestion = question;
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: currentQuestion }]);
    setQuestion('');
    setActivityEvents([]);
    eventIdRef.current = 0;
    toolStartTimesRef.current.clear();
    toolNamesRef.current.clear();
    activeAgentsRef.current.clear();
    const startTime = Date.now();
    setRequestStartTime(startTime);
    addActivity('llm_turn', 'Starting session...');

    try {
      // Call backend directly to bypass Next.js proxy buffering for SSE
      const response = await fetch('http://localhost:3001/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repository: selectedRepo,
          question: currentQuestion,
          sessionId,
          agent: selectedAgent,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const agentName = data.data?.parentToolCallId
                ? activeAgentsRef.current.get(data.data.parentToolCallId) || undefined
                : undefined;

              switch (data.type) {
                case 'assistant.turn_start':
                  addActivity('llm_turn', 'LLM thinking...', agentName);
                  break;

                case 'assistant.reasoning':
                  if (data.data?.reasoningText) {
                    addActivity('reasoning', data.data.reasoningText, agentName);
                  }
                  break;

                case 'assistant.message': {
                  // Track tool requests to map toolCallId -> agent name
                  if (data.data?.toolRequests) {
                    for (const tr of data.data.toolRequests) {
                      const trName = tr.name || tr.toolName || '';
                      if (['explorer', 'analyzer', 'architect', 'task'].some((a) => trName.includes(a))) {
                        // Extract agent name from arguments if it's a task tool
                        const agentType = tr.arguments?.agent_type || trName;
                        activeAgentsRef.current.set(tr.toolCallId, agentType);
                      }
                      // Store tool name for completion lookup
                      toolNamesRef.current.set(tr.toolCallId, trName);
                    }
                  }

                  if (data.data?.content && !data.data?.parentToolCallId) {
                    const content = data.data.content;
                    if (content.trim()) {
                      if (!data.data.toolRequests || data.data.toolRequests.length === 0) {
                        addActivity('message', content);
                        setMessages((prev) => [...prev, { role: 'assistant', content }]);
                      } else {
                        addActivity('reasoning', content, agentName);
                      }
                    }
                  } else if (data.data?.content && data.data?.parentToolCallId) {
                    const content = data.data.content;
                    if (content.trim()) {
                      addActivity('reasoning', content, agentName);
                    }
                  }
                  break;
                }

                case 'tool.execution_start': {
                  const tcId = data.data?.toolCallId;
                  if (tcId) {
                    toolStartTimesRef.current.set(tcId, Date.now());
                  }
                  const toolName = data.data?.toolName || toolNamesRef.current.get(tcId) || 'unknown';
                  const isAgentTool = ['task'].includes(toolName) && data.data?.arguments?.agent_type;
                  const agentType = data.data?.arguments?.agent_type;

                  if (isAgentTool) {
                    activeAgentsRef.current.set(tcId, agentType);
                    addActivity('agent_start', `Agent "${agentType}" started: ${data.data.arguments.prompt || data.data.arguments.name || ''}`, agentType);
                  } else {
                    // Build descriptive message from tool arguments
                    let detail = '';
                    const args = data.data?.arguments;
                    if (args?.path) {
                      // Shorten path - show last 3 segments
                      const parts = args.path.split('/');
                      detail = parts.length > 3 ? '.../' + parts.slice(-3).join('/') : args.path;
                    } else if (args?.command) {
                      detail = args.command.length > 80 ? args.command.substring(0, 80) + '...' : args.command;
                    } else if (args?.pattern) {
                      detail = `pattern: "${args.pattern}"`;
                    }
                    addActivity('tool_start', `${toolName}${detail ? ' → ' + detail : ''}`, agentName);
                  }
                  break;
                }

                case 'tool.execution_complete': {
                  const tcId = data.data?.toolCallId;
                  if (tcId) {
                    toolStartTimesRef.current.delete(tcId);
                    const completedAgent = activeAgentsRef.current.get(tcId);
                    if (completedAgent) {
                      const dur = toolStartTimesRef.current.has(tcId)
                        ? Date.now() - toolStartTimesRef.current.get(tcId)! : undefined;
                      addActivity('agent_complete', `Agent "${completedAgent}" finished`, completedAgent, dur);
                      activeAgentsRef.current.delete(tcId);
                    }
                    toolNamesRef.current.delete(tcId);
                  }
                  // Skip individual tool completion events - only show agent completions
                  break;
                }

                case 'permission.requested': {
                  const perm = data.data?.permissionRequest;
                  const kind = perm?.kind || 'unknown';
                  const intention = perm?.intention || '';
                  const path = perm?.path;
                  let detail = intention;
                  if (!detail && path) {
                    const parts = path.split('/');
                    detail = `${kind}: .../${parts.slice(-3).join('/')}`;
                  }
                  addActivity('permission', detail || `Permission: ${kind}`, agentName);
                  break;
                }

                case 'complete':
                  setSessionId(data.sessionId);
                  addActivity('message', 'Response complete');
                  // Fallback: show response if nothing was streamed
                  setMessages((prev) => {
                    const lastUserIdx = prev.findLastIndex((p) => p.role === 'user');
                    const hasAssistantResponse = prev.some(
                      (m, i) => m.role === 'assistant' && i > lastUserIdx
                    );
                    if (!hasAssistantResponse && data.response?.trim()) {
                      return [...prev, { role: 'assistant', content: data.response }];
                    }
                    return prev;
                  });
                  break;

                case 'error':
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: `Error: ${data.error}` },
                  ]);
                  break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Codebase Q&A</h1>
            <RepositorySelector
              repositories={repositories}
              selected={selectedRepo}
              onChange={setSelectedRepo}
            />
            {agents.length > 0 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {agents.map((agent) => (
                  <option key={agent.name} value={agent.name}>
                    {agent.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.username}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">Ask a question about {selectedRepo}</p>
                <p className="text-sm">Example: &quot;How does authentication work?&quot;</p>
              </div>
            </div>
          ) : (
            <>
              <MessageList messages={messages} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Activity Timeline */}
        {activityEvents.length > 0 && (
          <div className="px-6 pb-2">
            <ActivityTimeline events={activityEvents} startTime={requestStartTime} />
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && askQuestion()}
              placeholder="Ask a question about the codebase..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={askQuestion}
              disabled={isLoading || !question.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Thinking...' : 'Ask'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
