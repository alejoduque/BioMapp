import React, { useState } from 'react';
import { Headphones, Mic, MapPin, Calendar, Users, X } from 'lucide-react';
import { validatePassword } from '../config/auth';

const LandingPage = ({ onModeSelect }) => {
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
    onModeSelect('soundwalk');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `url('/images/background-image.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '100px'
    }}>
      <div style={{
        backgroundColor: 'rgb(87 79 54 / 10%)',
        borderRadius: '5px',
        boxShadow: 'rgba(0, 0, 0, 0.3) 0px 20px 50px',
        padding: '20px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'right'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'rgb(233, 237, 243)',
            marginBottom: '6px'
          }}>
            Paisaje Sonoro MANAKAI
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'rgb(10, 10, 12)',
            lineHeight: '1.5'
          }}>
            <a
              href="https://etc.radiolibre.xyz/posts/bioacusticabiocracia/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', textDecoration: 'underline' }}
            >
              Descubre y contribuye a la biodiversidad acústica de la Reserva Natural MANAKAI.
            </a>
          </p>
        </div>

        {/* Learn More Button */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setShowAboutPopover(true)}
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'rgb(186, 243, 224)',
              border: '2px solid rgb(18, 82, 61)',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: '0.2s'
            }}
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
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: 'rgb(115, 112, 84)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: '0.2s',
              boxShadow: 'rgba(16, 185, 129, 0.3) 0px 4px 12px'
            }}
          >
            <Headphones size={24} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Modo Recorrido Sonoro</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Escucha sonidos grabados mientras exploras</div>
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
                backgroundColor: 'rgb(117, 159, 69)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: '0.2s',
                boxShadow: 'rgba(59, 130, 246, 0.3) 0px 4px 12px',
                transform: 'translateY(0px)'
              }}
            >
              <Mic size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Modo Recolector</div>
                <div style={{ fontSize: '11px', opacity: 0.9 }}>Graba y contribuye nuevos sonidos</div>
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
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
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
          paddingTop: '20px',
          borderTop: '1px solid #E5E7EB',
          fontSize: '11px',
          color: '#9CA3AF'
        }}>
          <p>Reserva Natural MANAKAI • Proyecto de Biodiversidad Acústica</p>
          <p>Elige tu experiencia y sumérgete en los sonidos de la naturaleza</p>
        </div>
      </div>

      {/* Bilingual About Popover */}
      {showAboutPopover && (
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
          zIndex: 1000000,
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            maxWidth: '900px',
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Spanish Block - Only show Spanish */}
            <div style={{
              flex: 1,
              padding: '30px',
              textAlign: 'left',
              borderRight: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1F2937',
                marginBottom: '12px',
                textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)'
              }}>
                Paisaje Sonoro MANAKAI / BioMap
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#4B5563',
                lineHeight: '1.6',
                marginBottom: '16px',
                textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)'
              }}>
                Descubre y contribuye a la biodiversidad acústica de la Reserva Natural MANAKAI.
              </p>
              <p style={{
                fontSize: '13px',
                color: '#4B5563',
                lineHeight: '1.6',
                marginBottom: '16px',
                textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)'
              }}>
                BioMap es una aplicación web para grabar, mapear y compartir observaciones de audio de biodiversidad. Explora el paisaje sonoro de la reserva a través de recorridos guiados o contribuye con tus propias grabaciones ambientales.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MapPin size={16} color="#10B981" />
                <span style={{ fontSize: '12px', color: '#4B5563', textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)' }}>
                  Detección de ubicación por GPS
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Calendar size={16} color="#10B981" />
                <span style={{ fontSize: '12px', color: '#4B5563', textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)' }}>
                  Reproducción cronológica de audio
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Users size={16} color="#10B981" />
                <span style={{ fontSize: '12px', color: '#4B5563', textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)' }}>
                  Colección de sonidos impulsada por la comunidad
                </span>
              </div>
              <p style={{
                fontSize: '12px',
                color: '#6B7280',
                fontStyle: 'italic',
                marginTop: '16px',
                textShadow: '1px 1px 4px rgba(255, 255, 255, 0.8)'
              }}>
                Ideal para ciencia ciudadana, investigación de campo y amantes de la naturaleza.
              </p>
            </div>
            {/* Remove English Block */}
            <button
              onClick={() => setShowAboutPopover(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage; 