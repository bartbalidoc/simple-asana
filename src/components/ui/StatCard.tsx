// Shared metric card used on the dashboard and the manager cockpit. Icon tile +
// big tabular value + label. `tint` colors the icon tile; `accent` the value.
export function StatCard({
  label,
  value,
  icon,
  tint,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tint: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tint}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-tight tabular-nums ${accent}`}>{value}</div>
        <div className="text-xs text-gray-500 truncate">{label}</div>
      </div>
    </div>
  );
}
