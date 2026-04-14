"use client";

export type Clip = { prompt: string; duration: number };

type Props = {
  clips: Clip[];
  defaultDuration: number;
  disabled?: boolean;
  onChange: (next: Clip[]) => void;
};

export default function PromptList({ clips, defaultDuration, disabled, onChange }: Props) {
  const updatePrompt = (i: number, value: string) => {
    const next = clips.slice();
    next[i] = { ...next[i], prompt: value };
    onChange(next);
  };
  const updateDuration = (i: number, value: number) => {
    const next = clips.slice();
    next[i] = { ...next[i], duration: value };
    onChange(next);
  };
  const remove = (i: number) => {
    if (clips.length <= 1) return;
    onChange(clips.filter((_, idx) => idx !== i));
  };
  const add = () => {
    if (clips.length >= 20) return;
    onChange([...clips, { prompt: "", duration: defaultDuration }]);
  };

  return (
    <div className="space-y-3">
      {clips.map((c, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
              Clip {i + 1} · {c.duration}s
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled || clips.length <= 1}
              className="rounded-md px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          <textarea
            value={c.prompt}
            onChange={(e) => updatePrompt(i, e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder={`Describe this ${c.duration}-second scene…`}
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-500">
              <span>Duration</span>
              <span className="font-mono text-neutral-300">{c.duration}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={c.duration}
              disabled={disabled}
              onChange={(e) => updateDuration(i, Number(e.target.value))}
              className="w-full accent-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled || clips.length >= 20}
        className="w-full rounded-xl border border-dashed border-neutral-700 px-4 py-3 text-sm text-neutral-300 transition hover:border-indigo-500 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Add Prompt
      </button>
    </div>
  );
}
