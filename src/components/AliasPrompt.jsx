import React, { useState } from 'react';

const AliasPrompt = ({ onSubmit, onCancel }) => {
  const [alias, setAlias] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (alias.trim()) {
      onSubmit(alias.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgb(20 50 20 / 65%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#f0f1ec',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '340px',
        width: '90%',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#000000c9'
        }}>
          Tu nombre de caminante
        </h3>
        <p style={{
          margin: '0 0 16px 0',
          fontSize: '14px',
          color: '#6B7280'
        }}>
          Este nombre aparecerá en tus derivas sonoras y será visible cuando compartas tus recorridos.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ej: Marina, Juan, Caminante..."
            autoFocus
            maxLength={30}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid rgba(78,78,134,0.22)',
              borderRadius: '8px',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '16px'
            }}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={!alias.trim()}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: alias.trim() ? '#9dc04cd4' : '#9CA3AF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: alias.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f0f1ec',
                color: 'rgb(1 9 2 / 84%)',
                border: '1px solid rgba(78,78,134,0.22)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Omitir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AliasPrompt;
