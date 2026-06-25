"use client";

import React, { useEffect, useRef } from "react";
import { format } from "date-fns";
import { useCrm } from "@/context/CrmContext";
import { formatTime, formatDistance, getSessionColor } from "@/utils";

export const RightPanel = ({ className = "" }: { className?: string }) => {
  const {
    timeline,
    loadingTimeline,
    errorTimeline,
    selectedDate,
    setSelectedDate,
    selectedEmployee,
    rebuildTimeline,
    isRebuildingTimeline,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    playbackTime,
    setPlaybackTime,
    timelineDurationSeconds,
    selectedSessionId,
    setSelectedSessionId,
  } = useCrm();
  const animationRef = useRef<number | null>(null);
  const playbackTimeRef = useRef<number>(playbackTime);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  useEffect(() => {
    playbackTimeRef.current = playbackTime;
  }, [playbackTime]);

  useEffect(() => {
    if (!isPlaying || timelineDurationSeconds <= 0) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      const next = playbackTimeRef.current + (delta * playbackSpeed) / 1000;
      playbackTimeRef.current = next;

      if (timelineDurationSeconds > 0 && next >= timelineDurationSeconds) {
        setIsPlaying(false);
        setPlaybackTime(timelineDurationSeconds);
      } else {
        setPlaybackTime(next);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed, timelineDurationSeconds, setIsPlaying, setPlaybackTime]);

  return (
    <div className={`w-full lg:w-96 border-l border-gray-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loadingTimeline && (
          <div className="text-center text-gray-500 dark:text-slate-400 py-8">Loading timeline...</div>
        )}
        {errorTimeline && (
          <div className="text-center text-red-600 dark:text-red-400 py-8">Error: {errorTimeline}</div>
        )}
        {!loadingTimeline && !errorTimeline && !timeline && selectedEmployee && (
          <div className="text-center p-6 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-xl">
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {selectedEmployee.name}{" "}
              {selectedDate === new Date().toISOString().split("T")[0] ? "has" : "had"} not checked in on{" "}
              {format(new Date(selectedDate), "MMM d, yyyy")}
            </div>
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && !timeline.summaryAvailable && (
          <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-md">
            <div className="mb-3 font-medium text-yellow-800 dark:text-yellow-300">Timeline not yet calculated</div>
            {timeline.attendance && (
              <button
                onClick={() => rebuildTimeline(timeline.attendance._id)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-lg hover:opacity-90 text-sm font-medium cursor-pointer transition-opacity"
              >
                Rebuild Timeline
              </button>
            )}
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && timeline.attendance?.sessions?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Sessions</h3>
            <div className="space-y-2">
              {timeline.attendance.sessions.map((s, i) => {
                const isSelected = selectedSessionId === s.sessionId;
                const durationMin = s.checkOutAt
                  ? Math.round((new Date(s.checkOutAt).getTime() - new Date(s.checkInAt).getTime()) / 60000)
                  : null;
                return (
                  <button
                    key={s.sessionId}
                    onClick={() => setSelectedSessionId(isSelected ? null : s.sessionId)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? "border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getSessionColor(i) }}
                        />
                        <span className="font-medium text-gray-900 dark:text-slate-100">
                          {format(new Date(s.checkInAt), "h:mm a")} – {s.checkOutAt ? format(new Date(s.checkOutAt), "h:mm a") : "now"}
                        </span>
                      </div>
                      {durationMin !== null && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">{durationMin} min</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && timeline.summaryAvailable && (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Summary</h3>
                {timeline.attendance && (
                  <button
                    onClick={() => rebuildTimeline(timeline.attendance._id)}
                    disabled={isRebuildingTimeline}
                    title="Force-recompute this day's timeline (route smoothing, distances, anomalies) from the raw GPS points"
                    className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isRebuildingTimeline ? "Rebuilding…" : "Rebuild"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-md border border-gray-100 dark:border-slate-800/30">
                  <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Distance</div>
                  <div className="text-base font-bold text-gray-900 dark:text-slate-100">
                    {formatDistance(timeline.totals?.processedDistanceMeters || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-md border border-gray-100 dark:border-slate-800/30">
                  <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">GPS Quality</div>
                  <div className="text-base font-bold text-gray-900 dark:text-slate-100">
                    {Math.round(timeline.totals?.gpsQualityScore || 0)}%
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Time Breakdown</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-3 rounded-md border border-cyan-100 dark:border-cyan-900/30">
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">Working</div>
                  <div className="text-base font-bold text-cyan-900 dark:text-cyan-100">
                    {formatTime(timeline.totals?.workingSeconds || 0)}
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-100 dark:border-orange-900/30">
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Break</div>
                  <div className="text-base font-bold text-orange-900 dark:text-orange-100">
                    {formatTime(timeline.totals?.breakSeconds || 0)}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-900/30">
                  <div className="text-xs text-green-600 dark:text-green-400 mb-1">Moving</div>
                  <div className="text-base font-bold text-green-900 dark:text-green-100">
                    {formatTime(timeline.totals?.movingSeconds || 0)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-md border border-slate-100 dark:border-slate-800/50">
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Hold (Stop)</div>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {formatTime(timeline.totals?.holdSeconds || 0)}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-900/30 col-span-2">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">Data Gap</div>
                  <div className="text-base font-bold text-red-900 dark:text-red-100">
                    {formatTime(timeline.totals?.dataGapSeconds || 0)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Anomalies</h3>
              {timeline.anomalies && timeline.anomalies.length > 0 ? (
                timeline.anomalies.map((anomaly, i) => (
                  <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 rounded-md mb-2 text-sm">
                    <div className="font-medium text-yellow-800 dark:text-yellow-300">{anomaly.type}</div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      {format(new Date(anomaly.startAt), "MMM d, h:mm a")} - {format(new Date(anomaly.endAt), "h:mm a")} ({Math.round(anomaly.durationSeconds / 60)} min)
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400">No anomalies</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3">Playback</h3>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handlePlayPause}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm cursor-pointer"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm cursor-pointer"
                >
                  Stop
                </button>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md text-sm focus:outline-none"
                >
                  <option value={1}>1x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
              <input
                type="range"
                min={0}
                max={timelineDurationSeconds || 100}
                value={Math.min(playbackTime, timelineDurationSeconds || 100)}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  playbackTimeRef.current = value;
                  setPlaybackTime(value);
                }}
                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                Current Time: {new Date(Math.min(playbackTime, timelineDurationSeconds) * 1000).toISOString().substr(11, 8)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
