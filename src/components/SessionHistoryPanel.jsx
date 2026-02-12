import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, MapPin, Clock, Mic, Eye, EyeOff, Play } from 'lucide-react';
import walkSessionService from '../services/walkSessionService.js';
import userAliasService from '../services/userAliasService.js';

const SessionHistoryPanel = ({ onClose, onViewSession, onExportSession, visibleSessionIds, onToggleVisibility, onPlaySession }) => {
  const [sessions, setSessions] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [playModePickerFor, setPlayModePickerFor] = useState(null); // sessionId showing mode picker

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

  const isVisible = (sessionId) => {
    if (!visibleSessionIds) return true;
    return visibleSessionIds.has(sessionId);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '190px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(220,225,235,0.78)',
      borderRadius: '16px',
      boxShadow: 'rgba(78,78,134,0.25) 0px 10px 30px',
      width: '90%',
      maxWidth: '400px',
      maxHeight: '50vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10000,
      backdropFilter: 'blur(12px)'
    }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          position: 'relative'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#000000c9' }}>
            Capas de Derivas
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              fontSize: '18px',
              padding: '4px',
              lineHeight: 1
            }}
            title="Cerrar"
          >
            ✕
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
              const visible = isVisible(session.sessionId);
              const showingModePicker = playModePickerFor === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    borderRadius: '10px',
                    border: '1px solid rgba(78,78,134,0.15)',
                    borderLeft: `4px solid ${color}`,
                    backgroundColor: visible ? '#FAFAFA' : '#F3F4F6',
                    opacity: visible ? 1 : 0.6,
                    transition: 'opacity 0.2s, background-color 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#000000c9', marginBottom: '4px' }}>
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
                      {/* Eye toggle — visibility */}
                      <button
                        onClick={() => onToggleVisibility && onToggleVisibility(session.sessionId)}
                        title={visible ? 'Ocultar en mapa' : 'Mostrar en mapa'}
                        style={{
                          background: visible ? '#9dc04cd4' : 'none',
                          border: visible ? 'none' : '1px solid rgba(78,78,134,0.22)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: visible ? 'white' : '#9CA3AF'
                        }}
                      >
                        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      {/* Play button */}
                      <button
                        onClick={() => setPlayModePickerFor(showingModePicker ? null : session.sessionId)}
                        title="Reproducir deriva"
                        style={{
                          background: showingModePicker ? '#4e4e86' : 'none',
                          border: showingModePicker ? 'none' : '1px solid rgba(78,78,134,0.22)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: showingModePicker ? 'white' : 'rgb(1 9 2 / 84%)'
                        }}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => handleExport(session)}
                        title="Exportar ZIP"
                        style={{
                          background: 'none',
                          border: '1px solid rgba(78,78,134,0.22)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: 'rgb(1 9 2 / 84%)'
                        }}
                      >
                        <Download size={14} />
                      </button>
                      {isDeleting ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleDelete(session.sessionId)}
                            style={{
                              background: '#c24a6e',
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
                              border: '1px solid rgba(78,78,134,0.22)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              color: 'rgb(1 9 2 / 84%)',
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
                            border: '1px solid rgba(78,78,134,0.22)',
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            color: '#c24a6e'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline playback mode picker */}
                  {showingModePicker && (
                    <div style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(78,78,134,0.15)',
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      {[
                        { mode: 'nearby', label: 'Cercanos' },
                        { mode: 'chronological', label: 'Cronológico' },
                        { mode: 'jamm', label: 'Concatenado' }
                      ].map(({ mode, label }) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setPlayModePickerFor(null);
                            onPlaySession && onPlaySession(session.sessionId, mode);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#4e4e86',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Play size={10} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
    </div>
  );
};

export default SessionHistoryPanel;
