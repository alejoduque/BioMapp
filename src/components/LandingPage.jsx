import React, { useState } from 'react';
import { Headphones, Mic, X } from 'lucide-react';
import { validatePassword } from '../config/auth';

// Platform detection utility
const isCapacitorAndroid = () => {
  if (typeof window === 'undefined') return false;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isCapacitor = !!(window.Capacitor || window.capacitor);
  const isCordova = !!(window.cordova || window.Cordova);
  return isAndroid && (isCapacitor || isCordova);
};

const LandingPage = ({ onModeSelect, hasRequestedPermission, setHasRequestedPermission }) => {
  const [showCollectorAuth, setShowCollectorAuth] = useState(false);
  const [showAboutPopover, setShowAboutPopover] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (validatePassword(password)) {
      onModeSelect('collector');
    } else {
      setPasswordError('Contraseña incorrecta. Por favor, inténtelo de nuevo.');
      setPassword('');
    }
  };

  const handleSoundWalkSelect = () => {
    if (setHasRequestedPermission) setHasRequestedPermission(true);
    onModeSelect('soundwalk');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: 'url(/images/background-image.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.07)',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)'
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img 
            src="/biomapp.png" 
            alt="BioMapp"
            style={{
              maxWidth: '200px',
              height: 'auto',
              marginBottom: '16px'
            }}
          />
          <h2 style={{
            color: '#fff',
            margin: '0 0 8px 0',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            Derivas Sonoras \ SoundWalk / 
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.35)',
            margin: '0 0 24px 0',
            fontSize: '14px'
          }}>
            Mapas sonoros para la conservación
          </p>
        </div>

        {/* About Button */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setShowAboutPopover(true)}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            Saber Más
          </button>
        </div>

        {/* Mode Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* SoundWalk Mode */}
          <button
            onClick={handleSoundWalkSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.8)'}
          >
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Headphones size={20} />
            </div>
            <div>
              <div>Modo Recorrido Sonoro</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Explora sonidos grabados</div>
            </div>
          </button>

          {/* Collector Mode */}
          {!showCollectorAuth ? (
            <button
              onClick={() => setShowCollectorAuth(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)'}
            >
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Mic size={20} />
              </div>
              <div>
                <div>Modo Recolector</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Graba y comparte sonidos</div>
              </div>
            </button>
          ) : (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1F2937',
                marginTop: '0',
                marginBottom: '16px'
              }}>
                Ingresar Contraseña de Recolector
              </h3>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Ingresa la contraseña"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: passwordError ? '2px solid #EF4444' : '2px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    marginBottom: '8px',
                    boxSizing: 'border-box',
                    backgroundColor: '#fff'
                  }}
                />
                {passwordError && (
                  <div style={{
                    color: '#EF4444',
                    fontSize: '12px',
                    marginTop: '4px',
                    marginBottom: '12px'
                  }}>
                    {passwordError}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '16px'
                }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
                  >
                    Ingresar
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
                      borderRadius: '6px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4B5563'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6B7280'}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            margin: '4px 0'
          }}>
            etc.radiolibre.xyz • Plataforma de Mapeo Sonoro
          </p>
          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '11px',
            margin: '4px 0 0 0'
          }}>
            Explora y documenta los sonidos en tu entorno (sonosfera) 
          </p>
        </div>
      </div>

      {/* About Popover */}
      {showAboutPopover && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowAboutPopover(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
            >
              <X size={18} color="#4B5563" />
            </button>
            
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#111827',
              marginTop: '0',
              marginBottom: '16px'
            }}>
              Derivas Sonoras \ SoundWalk /
            </h2>
            
            <div style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#4B5563',
              marginBottom: '24px'
            }}>
              <p style={{ marginBottom: '16px' }}>
                <strong>BioMapp</strong> es un dispositivo para crear mapas sonoros comunitarios que nos permite explorar y documentar
                sonidos de naturalezas amplias en tiempos de crisis ecosistemica. Nuestra misión es generar derivas sonoras que capturen la diversidad acústica y faciliten
                la participación ciudadana y su conservación #bioacustica.
              </p>
              
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: '24px 0 8px 0'
              }}>
                Modo Recorrido Sonoro:
              </h3>
              <p style={{ marginBottom: '16px' }}>
                Explora los sonidos grabados en diferentes ubicaciones mientras te mueves por el mapa. Descubre la diversidad sonora de tu entorno.
              </p>
              
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: '24px 0 8px 0'
              }}>
                Modo Recolector:
              </h3>
              <p style={{ marginBottom: '16px' }}>
                Contribuye al proyecto grabando nuevos sonidos y compartiendo
                observaciones sobre la biodiversidad en tu área.
              </p>
              
              <p style={{ marginBottom: '0' }}>
                Para más información, escribe a:{' '}
                <a 
                  href="https://etc.radiolibre.xyz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    color: '#3B82F6',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  ping@radiolibre.xyz
                </a>
              </p>
            </div>
            
            <button
              onClick={() => setShowAboutPopover(false)}
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
