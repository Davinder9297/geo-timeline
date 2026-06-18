import React from 'react';
import { LeftPanel } from '../components/LeftPanel';
import { Map } from '../components/Map';
import { RightPanel } from '../components/RightPanel';
import { useAuth } from '../contexts/AuthContext';
import { useCrm } from '../contexts/CrmContext';

export const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const { selectedEmployee } = useCrm();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'white',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Geo Timeline CRM</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {selectedEmployee && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              Viewing: <span style={{ fontWeight: 500 }}>{selectedEmployee.name}</span>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              padding: '6px 12px',
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        <LeftPanel />
        <Map />
        {selectedEmployee && <RightPanel />}
      </div>
    </div>
  );
};
