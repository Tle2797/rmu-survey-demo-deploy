import type { ComponentType, ReactNode } from "react";

export type OverviewCardIcon = ComponentType<{ className?: string }>;

type OverviewCardProps = {
  icon: OverviewCardIcon;
  title: string;
  value: ReactNode;
  sub?: string;
  iconClass?: string;
  cardClass?: string;
};

export default function OverviewCard({
  icon: Icon,
  title,
  value,
  sub,
  iconClass = "from-sky-500 to-blue-600",
  cardClass = "",
}: OverviewCardProps) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString("th-TH") : value;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="break-words text-2xl font-black leading-tight tracking-tight text-slate-900">
            {formattedValue}
          </div>
          {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}
