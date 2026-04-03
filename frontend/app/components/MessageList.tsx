'use client';

import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Must match the display string passed to `runAsk` for the preset docs flow. */
export const PRESET_USER_MESSAGE = 'Generate documentation (preset)';

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => {
        const isPresetHeader =
          msg.role === 'user' && msg.content === PRESET_USER_MESSAGE;

        if (isPresetHeader) {
          return (
            <div key={idx} className="w-full pt-1">
              <h2 className="text-center text-lg font-semibold text-gray-900 tracking-tight">
                {PRESET_USER_MESSAGE}
              </h2>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
