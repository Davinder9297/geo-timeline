import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useCrm } from '../contexts/CrmContext';
import { LiveLocationStatus } from '../types';

const getStatusColor = (status: LiveLocationStatus, isStale: boolean) => {
  if (isStale) return { bg: '#E0E0E0', color: '#616161' };
  switch (status) {
    case LiveLocationStatus.WORKING:
      return { bg: '#E8F5E9', color: '#2E7D32' };
    case LiveLocationStatus.ON_BREAK:
      return { bg: '#FFF3E0', color: '#EF6C00' };
    case LiveLocationStatus.OFFLINE:
      return { bg: '#ECEFF1', color: '#455A64' };
    case LiveLocationStatus.CHECKED_OUT:
      return { bg: '#FFEBEE', color: '#C62828' };
    default:
      return { bg: '#E3F2FD', color: '#1565C0' };
  }
};

export const LeftPanel: React.FC = () => {
  const {
    employees,
    loadingEmployees,
    errorEmployees,
    selectedEmployeeId,
    selectEmployee,
  } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LiveLocationStatus | 'all'>('all');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div
      style={{
        width: '300px',
        borderRight: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Employees</h2>
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginTop: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
      </div>
      <div style={{ padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {['all', ...Object.values(LiveLocationStatus)].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as any)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '12px',
              border: statusFilter === status ? '2px solid #2196F3' : '1px solid #ddd',
              background: statusFilter === status ? '#E3F2FD' : 'white',
              color: statusFilter === status ? '#1565C0' : '#333',
              cursor: 'pointer',
            }}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingEmployees && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            Loading employees...
          </div>
        )}
        {errorEmployees && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#F44336' }}>
            Error: {errorEmployees}
          </div>
        )}
        {!loadingEmployees && !errorEmployees && filteredEmployees.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No employees found
          </div>
        )}
        {filteredEmployees.map(emp => {
          const statusStyle = getStatusColor(emp.status, emp.isStale);
          return (
            <div
              key={emp.employeeId}
              onClick={() => selectEmployee(emp.employeeId)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: selectedEmployeeId === emp.employeeId ? '#E3F2FD' : 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ fontWeight: 500 }}>{emp.name}</div>
                <div
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    opacity: emp.isStale ? 0.7 : 1,
                  }}
                >
                  {emp.status}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Last seen: {formatDistanceToNow(new Date(emp.lastUpdatedAt), { addSuffix: true })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
