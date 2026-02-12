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
        backgroundColor: 'rgb(20 50 20 / 35%)',
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
            alt="SoundWalk"
            style={{
              maxWidth: '280px',
              height: 'auto',
              marginBottom: '16px'
            }}
          />
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
          {/* Android (Capacitor): Single "Entrar" button */}
          {isCapacitorAndroid() ? (
            <button
              onClick={handleSoundWalkSelect}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                backgroundColor: 'rgba(157, 192, 76, 0.83)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '18px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(157, 192, 76, 1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(157, 192, 76, 0.83)'}
            >
              Entrar
            </button>
          ) : (
          <>
          {/* Web: SoundWalk Mode */}
          <button
            onClick={handleSoundWalkSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(157, 192, 76, 0.83)',
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
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(157, 192, 76, 1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(157, 192, 76, 0.83)'}
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
              <div>Recorrido Sonoro</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Explora y graba sonidos</div>
            </div>
          </button>

          {/* Web: Collector Mode with password */}
          {!showCollectorAuth ? (
            <button
              onClick={() => setShowCollectorAuth(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'rgba(78, 78, 134, 0.84)',
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
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(78, 78, 134, 1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(78, 78, 134, 0.84)'}
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
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Acceso con contraseña</div>
              </div>
            </button>
          ) : (
            <div style={{
              backgroundColor: 'rgba(220, 225, 235, 0.92)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#000000c9',
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
                    border: passwordError ? '2px solid #c24a6e' : '2px solid rgba(78,78,134,0.15)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    marginBottom: '8px',
                    boxSizing: 'border-box',
                    backgroundColor: '#f0f1ec'
                  }}
                />
                {passwordError && (
                  <div style={{
                    color: '#c24a6e',
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
                      backgroundColor: '#4e4e86',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d6b'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4e4e86'}
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
          </>
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
            Explora y documenta los sonidos en tu entorno
          </p>
        </div>
      </div>

      {/* About Popover — transparent floating panel */}
      {showAboutPopover && (
        <div style={{
          position: 'fixed',
          bottom: '50%',
          left: '50%',
          transform: 'translate(-50%, 50%)',
          backgroundColor: 'rgba(220,225,235,0.78)',
          borderRadius: '16px',
          boxShadow: 'rgba(78,78,134,0.25) 0px 10px 30px',
          backdropFilter: 'blur(12px)',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 1000,
          padding: '16px 16px 12px',
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => setShowAboutPopover(false)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
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

          <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgb(1 9 2 / 84%)' }}>
            <p style={{ marginTop: 0, marginBottom: '14px', fontSize: '13px' }}>
              <strong>SoundWalk</strong> es un dispositivo para crear mapas sonoros comunitarios.
              Genera derivas sonoras que capturan la diversidad acustica y facilitan
              la participacion ciudadana en su conservacion.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Barra superior</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                <span>ℹ️</span><span>Guia de uso</span>
                <span>📍</span><span>Centra el mapa en tu ubicacion / solicita GPS</span>
                <span>🗺️</span><span>Cambia la capa del mapa (OSM, Topo, Carto, Satelite...)</span>
                <span>⬇️</span><span>Importa una Deriva Sonora (.zip)</span>
                <span>🔍</span><span>Busca grabaciones por especie, notas o ubicacion</span>
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Barra inferior</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                <span>🗺️</span><span>Modos de migas: linea, calor o animada</span>
                <span>🟢</span><span><strong>Deriva</strong> — inicia caminata sonora con tracklog GPS</span>
                <span>⏸️</span><span>Pausa / reanuda (tiempo, GPS y tracklog se detienen)</span>
                <span>⏹️</span><span><strong>Fin</strong> — guarda la sesion, exporta ZIP automaticamente</span>
                <span>📋</span><span>Historial de derivas guardadas</span>
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Grabacion</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                <span>🎤</span><span>Boton rojo flotante — graba audio geoetiquetado</span>
                <span>📍</span><span>Pin azul = GPS activo, listo para grabar</span>
                <span>▶️</span><span>Reproductor: cercanos, concatenado o Jamm</span>
              </div>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              color: '#6B7280',
              lineHeight: '1.5',
              marginBottom: '10px'
            }}>
              Pellizca para zoom. Toca marcadores para escuchar. El contador de Deriva arranca al caminar 5m.
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', textAlign: 'center' }}>
              <a href="https://etc.radiolibre.xyz" target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280' }}>
                etc.radiolibre.xyz
              </a> — ping@radiolibre.xyz
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
