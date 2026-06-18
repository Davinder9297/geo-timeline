import React, { useState } from 'react';
import { useTracker } from './TrackerContext';

const App: React.FC = () => {
  const { user, login, logout, trackingState, startTracking, stopTracking, queue, lastSyncTime, lastError } = useTracker();

  const [employeeId, setEmployeeId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [attendanceId, setAttendanceId] = useState('');
  const [token, setToken] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(employeeId, companyId, attendanceId, token);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Geo Tracker Client</h1>

      {!user ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label>
            Employee ID
            <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label>
            Company ID
            <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label>
            Attendance ID
            <input type="text" value={attendanceId} onChange={e => setAttendanceId(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label>
            JWT Token
            <textarea value={token} onChange={e => setToken(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px', minHeight: '80px' }} />
          </label>
          <button type="submit" style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>
            Login
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
            <div>
              <div><strong>Employee:</strong> {user.employeeId}</div>
              <div><strong>Company:</strong> {user.companyId}</div>
              <div><strong>Attendance:</strong> {user.attendanceId}</div>
            </div>
            <button onClick={logout} style={{ padding: '8px', background: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}>
              Logout
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={startTracking}
              disabled={trackingState !== 'idle'}
              style={{
                flex: 1,
                padding: '12px',
                background: trackingState !== 'idle' ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                cursor: trackingState !== 'idle' ? 'not-allowed' : 'pointer',
              }}
            >
              Start Attendance
            </button>
            <button
              onClick={stopTracking}
              disabled={trackingState !== 'active'}
              style={{
                flex: 1,
                padding: '12px',
                background: trackingState !== 'active' ? '#ccc' : '#f44336',
                color: 'white',
                border: 'none',
                cursor: trackingState !== 'active' ? 'not-allowed' : 'pointer',
              }}
            >
              Stop Tracking
            </button>
          </div>

          <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '4px', background: '#f9f9f9' }}>
            <h3 style={{ marginTop: 0 }}>Status</h3>
            <div><strong>Tracking State:</strong> {trackingState}</div>
            <div><strong>Queued Points:</strong> {queue.length}</div>
            <div><strong>Last Sync:</strong> {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}</div>
            {lastError && (
              <div style={{ marginTop: '10px', color: 'red', fontWeight: 'bold' }}>
                <strong>Last Error:</strong> {lastError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
