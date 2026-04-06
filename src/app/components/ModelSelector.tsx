'use client';

/** Flat list for callers that need all model ids (e.g. validation). */
export const MODEL_OPTIONS = [
  { value: 'claude-haiku-4.5', label: 'claude-haiku-4.5' },
  { value: 'claude-sonnet-4.6', label: 'claude-sonnet-4.6' },
  { value: 'claude-opus-4.6', label: 'claude-opus-4.6' },
  { value: 'gpt-5.4-nano', label: 'gpt-5.4-nano' },
] as const;

const MODEL_SELECT_KEY = MODEL_OPTIONS.map((o) => o.value).join('|');

type Props = {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  id?: string;
};

export function ModelSelector({ value, onChange, disabled, id = 'model-select' }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-700" htmlFor={id}>
        Model:
      </label>
      <select
        id={id}
        key={MODEL_SELECT_KEY}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[12rem]"
      >
        <optgroup label="Anthropic">
          <option value="claude-haiku-4.5">claude-haiku-4.5</option>
          <option value="claude-sonnet-4.6">claude-sonnet-4.6</option>
          <option value="claude-opus-4.6">claude-opus-4.6</option>
        </optgroup>
        <optgroup label="OpenAI">
          <option value="gpt-5.4-nano">gpt-5.4-nano</option>
        </optgroup>
      </select>
    </div>
  );
}
