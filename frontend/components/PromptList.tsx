"use client";

type Props = {
  prompts: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

export default function PromptList({ prompts, disabled, onChange }: Props) {
  const update = (i: number, value: string) => {
    const next = prompts.slice();
    next[i] = value;
    onChange(next);
  };
  const remove = (i: number) => {
    if (prompts.length <= 1) return;
    onChange(prompts.filter((_, idx) => idx !== i));
  };
  const add = () => {
    if (prompts.length >= 20) return;
    onChange([...prompts, ""]);
  };

  return (
    <div className="space-y-3">
      {prompts.map((p, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Clip {i + 1} · 10s
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled || prompts.length <= 1}
              className="rounded-md px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          <textarea
            value={p}
            onChange={(e) => update(i, e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="Describe this 10-second scene…"
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled || prompts.length >= 20}
        className="w-full rounded-xl border border-dashed border-neutral-700 px-4 py-3 text-sm text-neutral-300 transition hover:border-indigo-500 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Add Prompt
      </button>
    </div>
  );
}
