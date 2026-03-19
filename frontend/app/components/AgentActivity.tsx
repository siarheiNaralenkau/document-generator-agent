'use client';

export function AgentActivity({ events }: { events: any[] }) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <div className="flex gap-4">
          {events.map((event, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-medium text-blue-900">
                {event.data.agentDisplayName}
              </span>
              {event.completed && (
                <span className="ml-2 text-green-600">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
