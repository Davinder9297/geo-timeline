import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(companyId, token);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'white',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 24px', fontSize: '22px', textAlign: 'center' }}>
          Geo Timeline CRM
        </h1>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
            Company ID
          </label>
          <input
            type="text"
            value={companyId}
            onChange={e => setCompanyId(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
            JWT Token
          </label>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
};
