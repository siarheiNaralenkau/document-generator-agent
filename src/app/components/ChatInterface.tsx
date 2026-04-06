'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RepositorySelector } from './RepositorySelector';
import { MessageList, PRESET_USER_MESSAGE } from './MessageList';
import { GeneratedDocumentsPanel } from './GeneratedDocumentsPanel';
import { ActivityTimeline, ActivityEvent } from './ActivityTimeline';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Same-origin `/api/*` is proxied to the backend via `next.config.js` rewrites (BACKEND_URL). Avoids broken absolute URLs when NEXT_PUBLIC_API_URL is mis-set. */
const ASK_API_URL = '/api/ask';

const GENERATE_DOCS_PROMPT =
  'Run the full two-phase BRD workflow from your instructions: Phase 1 feature-level requirements analysis, then Phase 2 BRD consolidation. Use the Repository root and Output directory from the context block. Produce feature-level-requirements.txt and FinalCopilot-requirements-response.md in the Output directory.';

export function ChatInterface({ user }: { user: any }) {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('claude-haiku-4.5');
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
  // Track document generation job for polling actual file creation
  const [docJob, setDocJob] = useState<{
    repo: string;
    feature: { filename: string; path: string; ready: boolean; completedAt?: number };
    final: { filename: string; path: string; ready: boolean; completedAt?: number };
  } | null>(null);
  // Simple notification banners for file completion
  const [notifications, setNotifications] = useState<{ id: number; message: string }[]>([]);
  const notificationIdRef = useRef(0);
  const docJobInProgress = !!docJob && (!docJob.feature.ready || !docJob.final.ready);
  const docJobCompleted = !!docJob && docJob.feature.ready && docJob.final.ready;

  useEffect(() => {
    fetch('/api/repositories', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const list = data.repositories || [];
        setRepositories(list);
        if (list.length > 0) {
          setSelectedRepoPath((prev) => {
            if (prev && list.some((r: { path: string }) => r.path === prev)) return prev;
            return list[0].path;
          });
        }
      })
      .catch((error) => {
        console.error('Error loading repositories:', error);
      });

  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activityEvents, docJobCompleted]);

  const addActivity = useCallback((type: ActivityEvent['type'], content: string, agent?: string, duration?: number) => {
    const id = ++eventIdRef.current;
    setActivityEvents((prev) => [
      ...prev,
      { id, type, content, agent, timestamp: Date.now(), duration },
    ]);
  }, []);

  const addNotification = useCallback((message: string) => {
    const id = ++notificationIdRef.current;
    setNotifications((prev) => [...prev, { id, message }]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  };

  const selectedRepoEntry = repositories.find((r) => r.path === selectedRepoPath);

  const runAsk = async (questionBody: string, userDisplayMessage: string) => {
    if (!selectedRepoPath || !selectedRepoEntry) return;

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: userDisplayMessage }]);
    setActivityEvents([]);
    eventIdRef.current = 0;
    toolStartTimesRef.current.clear();
    toolNamesRef.current.clear();
    activeAgentsRef.current.clear();
    const startTime = Date.now();
    setRequestStartTime(startTime);
    addActivity('llm_turn', 'Starting session...');
    // Clear previous document job state when starting a new run
    setDocJob(null);

    try {
      // Call backend directly to bypass Next.js proxy buffering for SSE
      const response = await fetch(ASK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repository: selectedRepoEntry.name,
          repositoryPath: selectedRepoEntry.path,
          question: questionBody,
          sessionId,
          agent: 'document-generator',
          model: selectedModel,
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
                  if (data.documents) {
                    const { repo, feature, final } = data.documents;
                    if (repo && feature?.path && feature?.filename && final?.path && final?.filename) {
                      setDocJob({
                        repo,
                        feature: {
                          filename: feature.filename,
                          path: feature.path,
                          ready: false,
                        },
                        final: {
                          filename: final.filename,
                          path: final.path,
                          ready: false,
                        },
                      });
                    }
                  }
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

  useEffect(() => {
    if (!docJob) return;
    if (docJob.feature.ready && docJob.final.ready) return;

    let cancelled = false;

    const pollStatus = async () => {
      if (cancelled) return;

      const searchParams = new URLSearchParams();
      if (!docJob.feature.ready) {
        searchParams.append('featurePath', docJob.feature.path);
      }
      if (!docJob.final.ready) {
        searchParams.append('finalPath', docJob.final.path);
      }

      if ([...searchParams.keys()].length === 0) {
        return;
      }

      try {
        const res = await fetch(`/api/document-status?${searchParams.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          return;
        }
        const status = await res.json();

        setDocJob((prev) => {
          if (!prev) return prev;
          let changed = false;
          const next = {
            repo: prev.repo,
            feature: { ...prev.feature },
            final: { ...prev.final },
          };

          if (!next.feature.ready && status.featureReady) {
            next.feature.ready = true;
            next.feature.completedAt = status.featureMtime
              ? Date.parse(status.featureMtime)
              : Date.now();
            const timeLabel = new Date(next.feature.completedAt).toLocaleTimeString([], {
              hour12: false,
            });
            addActivity(
              'message',
              `Feature-level requirements for ${next.repo} generated at ${timeLabel}`
            );
            addNotification(
              `Feature-level requirements for ${next.repo} are ready (generated at ${timeLabel}).`
            );
            changed = true;
          }

          if (!next.final.ready && status.finalReady) {
            next.final.ready = true;
            next.final.completedAt = status.finalMtime
              ? Date.parse(status.finalMtime)
              : Date.now();
            const timeLabel = new Date(next.final.completedAt).toLocaleTimeString([], {
              hour12: false,
            });
            addActivity(
              'message',
              `Final BRD for ${next.repo} generated at ${timeLabel}`
            );
            addNotification(
              `Final BRD for ${next.repo} is ready (generated at ${timeLabel}).`
            );
            changed = true;
          }

          return changed ? next : prev;
        });
      } catch {
        // Silent failure; next poll may succeed
      } finally {
        if (!cancelled && !(docJob.feature.ready && docJob.final.ready)) {
          setTimeout(pollStatus, 5000);
        }
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
    };
  }, [docJob, addActivity, addNotification]);

  const generateDocumentation = async () => {
    if (
      !selectedRepoPath ||
      !selectedRepoEntry
    ) {
      return;
    }
    await runAsk(GENERATE_DOCS_PROMPT, PRESET_USER_MESSAGE);
  };

  const addRepositoryFromUrl = async () => {
    const url = cloneUrl.trim();
    if (!url) return;
    setCloneError('');
    setCloneLoading(true);
    try {
      const res = await fetch('/api/repositories/clone', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add repository');
      }
      const listRes = await fetch('/api/repositories', { credentials: 'include' });
      const listData = await listRes.json();
      const list = listData.repositories || [];
      setRepositories(list);
      if (data.repository?.path) {
        setSelectedRepoPath(data.repository.path);
      } else if (list.length > 0) {
        setSelectedRepoPath(list[0].path);
      }
      setCloneUrl('');
    } catch (e: unknown) {
      setCloneError(e instanceof Error ? e.message : 'Failed to add repository');
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">Documentation</h1>
              <RepositorySelector
                repositories={repositories}
                selected={selectedRepoPath}
                onChange={setSelectedRepoPath}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="url"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={cloneLoading}
                />
                <button
                  type="button"
                  onClick={addRepositoryFromUrl}
                  disabled={cloneLoading || !cloneUrl.trim()}
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloneLoading ? 'Cloning…' : 'Add repo'}
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-600">
                  Using <span className="font-medium">document-generator</span> agent
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700" htmlFor="model-select">
                    Model:
                  </label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="claude-haiku-4.5">claude-haiku-4.5</option>
                    <option value="claude-sonnet-4.6">claude-sonnet-4.6</option>
                    <option value="claude-opus-4.6">claude-opus-4.6</option>
                  </select>
                </div>
                {selectedRepoPath ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={generateDocumentation}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isLoading ? 'Working…' : 'Generate Docs'}
                    </button>
                    {docJobInProgress && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span
                          className="inline-block h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"
                          aria-label="Generating documentation"
                        />
                        <span>Generating…</span>
                      </div>
                    )}
                    {docJobCompleted && !docJobInProgress && (
                      <span className="text-sm font-medium text-emerald-700">Completed</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Select a repository for Generate Docs.</span>
                )}
              </div>
            </div>
            {cloneError ? <p className="text-sm text-red-600">{cloneError}</p> : null}
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
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="px-6 pt-4 space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-900"
              >
                {n.message}
              </div>
            ))}
          </div>
        )}
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-center text-gray-500 text-sm">
                {selectedRepoPath
                  ? 'No messages yet. Use Generate Docs to run the workflow.'
                  : 'Add or select a repository, then use Generate Docs.'}
              </p>
            </div>
          ) : (
            <>
              <MessageList messages={messages} />
              {docJobCompleted && docJob ? (
                <GeneratedDocumentsPanel
                  featurePath={docJob.feature.path}
                  featureFilename={docJob.feature.filename}
                  finalPath={docJob.final.path}
                  finalFilename={docJob.final.filename}
                />
              ) : null}
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
      </div>
    </div>
  );
}
