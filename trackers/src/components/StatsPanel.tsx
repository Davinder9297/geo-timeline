"use client";

import React from "react";
import type { EmployeeStatsDay } from "@/types";
import { formatTime, formatDistance } from "@/utils";

interface StatsPanelProps {
  stats: EmployeeStatsDay[] | undefined;
  loading: boolean;
}

const BarChart = ({
  data,
  valueKey,
  fromColor,
  toColor,
  formatValue,
}: {
  data: EmployeeStatsDay[];
  valueKey: "workingSeconds" | "distanceMeters";
  fromColor: string;
  toColor: string;
  formatValue: (v: number) => string;
}) => {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const width = 280;
  const height = 100;
  const barGap = 8;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  const gradientId = `grad-${valueKey}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={fromColor} />
          <stop offset="100%" stopColor={toColor} />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const value = d[valueKey];
        const barHeight = Math.max((value / max) * (height - 20), value > 0 ? 4 : 0);
        const x = i * (barWidth + barGap);
        const y = height - 16 - barHeight;
        const isToday = i === data.length - 1;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={5}
              fill={`url(#${gradientId})`}
              opacity={isToday ? 1 : 0.4}
            />
            <text
              x={x + barWidth / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.4)"
            >
              {new Date(d.date).toLocaleDateString([], { weekday: "short" })[0]}
            </text>
            {value > 0 && (
              <title>{`${new Date(d.date).toLocaleDateString()}: ${formatValue(value)}`}</title>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export const StatsPanel = ({ stats, loading }: StatsPanelProps) => {
  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-xs text-white/40">Loading stats…</div>
      </div>
    );
  }

  if (!stats || stats.length === 0) return null;

  const today = stats[stats.length - 1];
  const totalWeekSeconds = stats.reduce((sum, d) => sum + d.workingSeconds, 0);
  const totalWeekDistance = stats.reduce((sum, d) => sum + d.distanceMeters, 0);

  return (
    <div className="space-y-3">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">Working Hours</h3>
          <span className="text-[11px] text-white/40">{formatTime(totalWeekSeconds)} / 7d</span>
        </div>
        <BarChart
          data={stats}
          valueKey="workingSeconds"
          fromColor="#22d3ee"
          toColor="#818cf8"
          formatValue={formatTime}
        />
        <div className="mt-1 text-lg font-bold text-white">{formatTime(today.workingSeconds)}</div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide">Distance</h3>
          <span className="text-[11px] text-white/40">{formatDistance(totalWeekDistance)} / 7d</span>
        </div>
        <BarChart
          data={stats}
          valueKey="distanceMeters"
          fromColor="#34d399"
          toColor="#22d3ee"
          formatValue={formatDistance}
        />
        <div className="mt-1 text-lg font-bold text-white">{formatDistance(today.distanceMeters)}</div>
      </div>
    </div>
  );
};
