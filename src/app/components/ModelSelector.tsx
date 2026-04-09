'use client';

/** Flat list for callers that need all model ids (e.g. validation). */
export const MODEL_OPTIONS = [
  { value: 'claude-haiku-latest', label: 'claude-haiku-latest' },
  { value: 'claude-sonnet-latest', label: 'claude-sonnet-latest' },
  { value: 'claude-opus-latest', label: 'claude-opus-latest' }
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
          <option value="claude-haiku-latest">claude-haiku-latest</option>
          <option value="claude-sonnet-latest">claude-sonnet-latest</option>
          <option value="claude-opus-latest">claude-opus-latest</option>
        </optgroup>
      </select>
    </div>
  );
}
