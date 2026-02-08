import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Clock, MapPin, Route, Download, List } from 'lucide-react';
import walkSessionService from '../services/walkSessionService.js';
import userAliasService from '../services/userAliasService.js';
import breadcrumbService from '../services/breadcrumbService.js';

const WalkSessionPanel = ({
  activeSession,
  userLocation,
  onStartSession,
  onEndSession,
  onRecordPress,
  onShowHistory
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const timerRef = useRef(null);

  // Timer for active session
  useEffect(() => {
    if (activeSession) {
      const update = () => {
        const ms = Date.now() - activeSession.startTime;
        setElapsed(Math.floor(ms / 1000));
        // Get distance from breadcrumbs
        const data = breadcrumbService.getSessionData();
        if (data?.summary) {
          setDistance(data.summary.totalDistance || 0);
        }
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      setElapsed(0);
      setDistance(0);
    }
  }, [activeSession]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const handleStart = async () => {
    try {
      const session = walkSessionService.startSession();
      if (userLocation) {
        await walkSessionService.startTracking(userLocation);
      }
      onStartSession(session);
    } catch (error) {
      console.error('Error starting walk session:', error);
    }
  };

  const handleEnd = () => {
    setShowEndConfirm(true);
  };

  const confirmEnd = () => {
    try {
      if (sessionTitle.trim()) {
        walkSessionService.updateSession(activeSession.sessionId, { title: sessionTitle.trim() });
      }
      const ended = walkSessionService.endSession(activeSession.sessionId);
      setShowEndConfirm(false);
      setSessionTitle('');
      onEndSession(ended);
    } catch (error) {
      console.error('Error ending walk session:', error);
    }
  };

  const userColor = userAliasService.aliasToHexColor(userAliasService.getAlias());
  const recordingCount = activeSession?.recordingIds?.length || 0;

  // No active session: show start button + history
  if (!activeSession) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px',
        zIndex: 1000
      }}>
        <button
          onClick={handleStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#10B981',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            padding: '12px 20px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
          }}
        >
          <Route size={18} />
          Iniciar Deriva
        </button>
        <button
          onClick={onShowHistory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'white',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: '24px',
            padding: '12px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <List size={16} />
          Historial
        </button>
      </div>
    );
  }

  // Active session: show session bar
  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTop: `3px solid ${userColor}`,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1000,
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Session stats */}
        <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#374151' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} />
            {formatTime(elapsed)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={14} />
            {formatDistance(distance)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#10B981' }}>
            <Mic size={14} />
            {recordingCount}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onRecordPress}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Mic size={14} />
            Grabar
          </button>
          <button
            onClick={handleEnd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#6B7280',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Square size={14} />
            Finalizar
          </button>
        </div>
      </div>

      {/* End session confirmation modal */}
      {showEndConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '340px',
            width: '90%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#111827' }}>
              Finalizar Deriva Sonora
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6B7280' }}>
              {formatTime(elapsed)} caminando — {formatDistance(distance)} — {recordingCount} grabacion(es)
            </p>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Nombre de la deriva (opcional)"
              autoFocus
              maxLength={60}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '14px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={confirmEnd}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Guardar Deriva
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalkSessionPanel;
