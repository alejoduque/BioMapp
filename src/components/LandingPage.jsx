import React, { useState } from 'react';
import { Headphones, Mic, MapPin, Calendar, Users } from 'lucide-react';

const LandingPage = ({ onModeSelect }) => {
  const [showCollectorAuth, setShowCollectorAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === 'manakai') {
      onModeSelect('collector');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleSoundWalkSelect = () => {
    onModeSelect('soundwalk');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%), 
                   url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><pattern id="nature" patternUnits="userSpaceOnUse" width="200" height="200"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="150" cy="100" r="1.5" fill="rgba(255,255,255,0.08)"/><circle cx="100" cy="150" r="1" fill="rgba(255,255,255,0.06)"/><path d="M0 180 Q50 160 100 180 T200 180" stroke="rgba(255,255,255,0.05)" fill="none" stroke-width="1"/><path d="M50 20 Q75 10 100 20 T150 20" stroke="rgba(255,255,255,0.03)" fill="none" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(%23nature)"/></svg>')`,
      backgroundSize: 'cover, 200px 200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        padding: '30px',
        maxWidth: '550px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: '6px'
          }}>
            MANAKAI Soundscape
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            lineHeight: '1.5'
          }}>
            Discover and contribute to the acoustic biodiversity of the MANAKAI Natural Reserve
          </p>
        </div>

        {/* App Description */}
        <div style={{
          backgroundColor: '#F9FAFB',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '12px'
          }}>
            About This App
          </h2>
          <p style={{
            fontSize: '13px',
            color: '#4B5563',
            lineHeight: '1.5',
            marginBottom: '12px'
          }}>
            MANAKAI Soundscape is a dual-mode application that allows you to either explore the reserve's 
            acoustic environment through guided soundwalks or contribute to the growing collection of 
            environmental recordings.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <MapPin size={14} color="#10B981" />
            <span style={{ fontSize: '12px', color: '#4B5563' }}>
              GPS-based location detection
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Calendar size={14} color="#10B981" />
            <span style={{ fontSize: '12px', color: '#4B5563' }}>
              Chronological audio playback
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} color="#10B981" />
            <span style={{ fontSize: '12px', color: '#4B5563' }}>
              Community-driven sound collection
            </span>
          </div>
        </div>

        {/* Mode Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* SoundWalk Mode */}
          <button
            onClick={handleSoundWalkSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            <Headphones size={24} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>SoundWalk Mode</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Listen to recorded sounds as you explore</div>
            </div>
          </button>

          {/* Collector Mode */}
          {!showCollectorAuth ? (
            <button
              onClick={() => setShowCollectorAuth(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <Mic size={24} />
                          <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Collector Mode</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Record and contribute new sounds</div>
            </div>
            </button>
          ) : (
            <div style={{
              backgroundColor: '#F3F4F6',
              borderRadius: '12px',
              padding: '20px',
              border: '2px solid #3B82F6'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1F2937',
                marginBottom: '12px'
              }}>
                Enter Collector Password
              </h3>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Enter password"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: passwordError ? '2px solid #EF4444' : '2px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    marginBottom: '8px',
                    boxSizing: 'border-box'
                  }}
                />
                {passwordError && (
                  <div style={{
                    fontSize: '12px',
                    color: '#EF4444',
                    marginBottom: '12px'
                  }}>
                    {passwordError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Enter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCollectorAuth(false);
                      setPassword('');
                      setPasswordError('');
                    }}
                    style={{
                      backgroundColor: '#6B7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #E5E7EB',
          fontSize: '11px',
          color: '#9CA3AF'
        }}>
          <p>MANAKAI Natural Reserve • Acoustic Biodiversity Project</p>
          <p>Choose your experience and immerse yourself in the sounds of nature</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 