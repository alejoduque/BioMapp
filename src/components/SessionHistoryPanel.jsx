import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, MapPin, Clock, Mic, Eye } from 'lucide-react';
import walkSessionService from '../services/walkSessionService.js';
import userAliasService from '../services/userAliasService.js';

const SessionHistoryPanel = ({ onClose, onViewSession, onExportSession }) => {
  const [sessions, setSessions] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    setSessions(walkSessionService.getCompletedSessions().reverse());
  }, []);

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDuration = (ms) => {
    if (!ms) return '--';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
  };

  const formatDistance = (meters) => {
    if (!meters) return '--';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const handleDelete = (sessionId) => {
    walkSessionService.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    setConfirmDeleteId(null);
  };

  const handleExport = async (session) => {
    try {
      // Dynamic import to avoid circular deps
      const { default: DeriveSonoraExporter } = await import('../utils/deriveSonoraExporter.js');
      await DeriveSonoraExporter.exportDerive(session.sessionId);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px 16px 0 0',
        width: '100%',
        maxHeight: '70vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#111827' }}>
            Mis Derivas Sonoras
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6B7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Session list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 16px' }}>
          {sessions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: '14px' }}>
              No hay derivas guardadas aún.
              <br />
              Inicia una caminata para crear tu primera deriva sonora.
            </p>
          ) : (
            sessions.map(session => {
              const color = userAliasService.aliasToHexColor(session.userAlias);
              const isDeleting = confirmDeleteId === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    borderLeft: `4px solid ${color}`,
                    backgroundColor: '#FAFAFA'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#111827', marginBottom: '4px' }}>
                        {session.title || 'Deriva sin título'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                        {formatDate(session.startTime)} — {session.userAlias}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B7280' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} />
                          {formatDuration(session.endTime - session.startTime)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} />
                          {formatDistance(session.summary?.totalDistance)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Mic size={12} />
                          {session.recordingIds?.length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                      <button
                        onClick={() => onViewSession(session)}
                        title="Ver en mapa"
                        style={{
                          background: 'none',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#374151'
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleExport(session)}
                        title="Exportar ZIP"
                        style={{
                          background: 'none',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#374151'
                        }}
                      >
                        <Download size={14} />
                      </button>
                      {isDeleting ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleDelete(session.sessionId)}
                            style={{
                              background: '#EF4444',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              color: 'white',
                              fontSize: '11px'
                            }}
                          >
                            Si
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              background: 'none',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              color: '#374151',
                              fontSize: '11px'
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(session.sessionId)}
                          title="Eliminar"
                          style={{
                            background: 'none',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            color: '#EF4444'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionHistoryPanel;
