"use client";

type Aspect = "16:9" | "9:16";

type Props = {
  aspect: Aspect;
  fade: boolean;
  duration: number;
  disabled?: boolean;
  onAspectChange: (a: Aspect) => void;
  onFadeChange: (f: boolean) => void;
  onDurationChange: (d: number) => void;
};

export default function OptionsBar({
  aspect,
  fade,
  duration,
  disabled,
  onAspectChange,
  onFadeChange,
  onDurationChange,
}: Props) {
  const aspectButton = (value: Aspect, label: string) => {
    const active = aspect === value;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAspectChange(value)}
        className={`px-3 py-1.5 text-sm transition ${
          active
            ? "bg-indigo-500 text-white"
            : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
        } first:rounded-l-lg last:rounded-r-lg border border-neutral-800 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-6">
      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-neutral-500">
          Aspect Ratio
        </div>
        <div className="inline-flex">
          {aspectButton("16:9", "16:9 Landscape")}
          {aspectButton("9:16", "9:16 Portrait")}
        </div>
      </div>

      <div className="min-w-[220px] flex-1">
        <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-neutral-500">
          <span>Default Clip Duration</span>
          <span className="font-mono text-neutral-300">{duration}s</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={duration}
          disabled={disabled}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="w-full accent-indigo-500 disabled:opacity-50"
        />
        <div className="mt-1 flex justify-between text-[10px] text-neutral-600">
          <span>1s</span>
          <span>5s</span>
          <span>10s</span>
        </div>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 pb-1 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={fade}
          disabled={disabled}
          onChange={(e) => onFadeChange(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-indigo-500"
        />
        Fade transitions
      </label>
    </div>
  );
}
