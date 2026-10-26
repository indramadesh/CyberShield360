/** Small bar chart of real daily counts (e.g. scans per day over the last week). */
export function ActivityChart({ data, height = 64 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const summary = data.map((d) => `${d.label}: ${d.value}`).join(", ");
  return (
    <figure aria-label={`Scans per day. ${summary}. Total ${total}.`}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-t-sm bg-primary/80"
              style={{ height: `${Math.max(d.value ? 8 : 3, (d.value / max) * 100)}%`, opacity: d.value ? 1 : 0.25 }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[0.65rem] text-subtle">{d.label}</div>
        ))}
      </div>
    </figure>
  );
}
