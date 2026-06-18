import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useCrm } from '../contexts/CrmContext';
import { formatTime, formatDistance } from '../utils';

export const RightPanel: React.FC = () => {
  const { timeline, loadingTimeline, errorTimeline, selectedDate, setSelectedDate, rebuildTimeline } = useCrm();
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
      setPlaybackTime(prev => prev + delta * playbackSpeed / 1000);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  return (
    <div
      style={{
        width: '380px',
        borderLeft: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loadingTimeline && (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            Loading timeline...
          </div>
        )}
        {errorTimeline && (
          <div style={{ textAlign: 'center', color: '#F44336', padding: '20px' }}>
            Error: {errorTimeline}
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && !timeline.summaryAvailable && (
          <div style={{ textAlign: 'center', padding: '20px', background: '#FFF3E0', borderRadius: '4px' }}>
            <div style={{ marginBottom: '12px', fontWeight: 500 }}>Timeline not yet calculated</div>
            <button
              onClick={() => {
                if (timeline.attendance) rebuildTimeline(timeline.attendance.attendanceId);
              }}
              style={{
                padding: '8px 16px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Rebuild Timeline
            </button>
          </div>
        )}
        {!loadingTimeline && !errorTimeline && timeline && timeline.summaryAvailable && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                Totals
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Distance</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>
                    {formatDistance(timeline.totals?.processedDistanceMeters || 0)}
                  </div>
                </div>
                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Working</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>
                    {formatTime(timeline.totals?.workingSeconds || 0)}
                  </div>
                </div>
                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Break</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>
                    {formatTime(timeline.totals?.breakSeconds || 0)}
                  </div>
                </div>
                <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>GPS Quality</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>
                    {Math.round(timeline.totals?.gpsQualityScore || 0)}%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                Anomalies
              </h3>
              {timeline.anomalies && timeline.anomalies.length > 0 ? (
                timeline.anomalies.map((anomaly, i) => (
                  <div key={i} style={{ padding: '8px', background: '#fff9c4', marginBottom: '6px', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{anomaly.type}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      {format(new Date(anomaly.startAt), 'MMM d, h:mm a')} - {format(new Date(anomaly.endAt), 'h:mm a')} ({Math.round(anomaly.durationSeconds / 60)} min)
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#666', fontSize: '13px' }}>No anomalies</div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                Playback
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <button
                  onClick={handlePlayPause}
                  style={{
                    padding: '6px 12px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    padding: '6px 12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Stop
                </button>
                <select
                  value={playbackSpeed}
                  onChange={e => setPlaybackSpeed(Number(e.target.value))}
                  style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
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
                onChange={e => setPlaybackTime(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                Current Time: {new Date(playbackTime * 1000).toISOString().substr(11, 8)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
