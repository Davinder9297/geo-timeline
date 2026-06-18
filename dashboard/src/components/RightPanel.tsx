"use client";

import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useCrm } from "@/context/CrmContext";
import { formatTime, formatDistance } from "@/utils";

export const RightPanel = () => {
  const {
    timeline,
    loadingTimeline,
    errorTimeline,
    selectedDate,
    setSelectedDate,
    rebuildTimeline,
  } = useCrm();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackTime, setPlaybackTime] = useState(0);
  const animationRef = useRef<number | null>(null);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      setPlaybackTime((prev) => prev + delta * playbackSpeed / 1000);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  return (
    <div className="w-96 border-l border-gray-200 flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loadingTimeline && (
          <div className="text-center text-gray-500 py-8">Loading timeline...</div>
        )}
        {errorTimeline && (
          <div className="text-center text-red-600 py-8">Error: {errorTimeline}</div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && !timeline.summaryAvailable && (
          <div className="text-center p-4 bg-yellow-50 rounded-md">
            <div className="mb-3 font-medium text-yellow-800">Timeline not yet calculated</div>
            {timeline.attendance && (
              <button
                onClick={() => rebuildTimeline(timeline.attendance.attendanceId)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Rebuild Timeline
              </button>
            )}
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && timeline.summaryAvailable && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Totals</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">Distance</div>
                  <div className="text-lg font-bold">
                    {formatDistance(timeline.totals?.processedDistanceMeters || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">Working</div>
                  <div className="text-lg font-bold">
                    {formatTime(timeline.totals?.workingSeconds || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">Break</div>
                  <div className="text-lg font-bold">
                    {formatTime(timeline.totals?.breakSeconds || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-xs text-gray-500 mb-1">GPS Quality</div>
                  <div className="text-lg font-bold">
                    {Math.round(timeline.totals?.gpsQualityScore || 0)}%
                  </div>
                </div>
              </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Anomalies</h3>
                {timeline.anomalies && timeline.anomalies.length > 0 ? (
                  timeline.anomalies.map((anomaly, i) => (
                    <div key={i} className="p-3 bg-yellow-50 rounded-md mb-2 text-sm">
                      <div className="font-medium text-yellow-800">{anomaly.type}</div>
                      <div className="text-xs text-yellow-700 mt-1">
                        {format(new Date(anomaly.startAt), "MMM d, h:mm a")} - {format(new Date(anomaly.endAt), "h:mm a")} ({Math.round(anomaly.durationSeconds / 60)} min)
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No anomalies</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Playback</h3>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={handlePlayPause}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={handleStop}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                  >
                    Stop
                  </button>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={1}>1x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                  </select>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playbackTime % 100}
                  onChange={(e) => setPlaybackTime(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-2">
                  Current Time: {new Date(playbackTime * 1000).toISOString().substr(11, 8)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
};
