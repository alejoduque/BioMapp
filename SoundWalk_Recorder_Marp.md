---
marp: true
theme: default
paginate: true
backgroundColor: #ffffff
backgroundImage: url('public/images/background-image.jpg')
backgroundSize: cover
backgroundPosition: center
color: white
header: 'SoundWalk Recorder - Arte Sonoro + Bioacústica'
footer: 'Proyecto Open Source | GitHub: alejoduque/BioMapp'
---

<style>
section {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 18px;
  padding: 80px 100px 120px 100px; /* Safe area: top, right, bottom, left */
  background-image: url('public/images/background-image.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

/* Logo brand en esquina superior derecha - Mucho más grande */
section::before {
  content: '';
  position: absolute;
  top: 20px;
  right: 20px;
  width: 180px;
  height: 180px;
  background-image: url('public/biomapp.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.9;
  z-index: 10;
}

/* Overlay para mejorar legibilidad */
section::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1;
}

/* Contenido encima del overlay */
section > * {
  position: relative;
  z-index: 2;
}

h1 {
  color: #FFD700;
  font-size: 32px;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
  margin-bottom: 20px;
  margin-top: 0;
}

h2 {
  color: #87CEEB;
  font-size: 24px;
  margin-top: 25px;
  margin-bottom: 15px;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.7);
}

h3 {
  color: #98FB98;
  font-size: 20px;
  margin-bottom: 10px;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.7);
}

ul, ol {
  font-size: 16px;
  line-height: 1.4;
  margin: 10px 0;
  padding-left: 20px;
}

li {
  margin: 5px 0;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
}

.emoji {
  font-size: 22px;
}

/* Background único para todo el contenido de cada slide */
section > :not(style) {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(5px);
  padding: 25px;
  border-radius: 12px;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Reset para elementos dentro del bloque principal */
section h1, section h2, section h3, section ul, section ol, section p, section div {
  background: none !important;
  backdrop-filter: none !important;
  border: none !important;
  margin: 10px 0 !important;
  padding: 0 !important;
}

/* Mantener la clase highlight para casos específicos */
.highlight {
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  padding: 20px;
  border-radius: 10px;
  margin: 15px 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.center {
  text-align: center;
}

/* Safe area para diferentes formatos de pantalla */
@media (max-width: 1024px) {
  section {
    padding: 60px 80px 100px 80px;
    font-size: 16px;
  }
  h1 { font-size: 28px; }
  h2 { font-size: 22px; }
  h3 { font-size: 18px; }
}

/* Ajustes para el logo en pantallas pequeñas */
@media (max-width: 768px) {
  section::before {
    width: 140px;  /* Mucho más grande para mobile */
    height: 140px;
    top: 15px;
    right: 15px;
  }
  section {
    padding: 50px 60px 80px 60px;
  }
}
</style>

---

# <span class="emoji">🎵</span> **SoundWalk Recorder**
## *Captura, Explora y Comparte Paisajes Sonoros*

<div class="highlight">

**Una aplicación móvil que fusiona:**
- <span class="emoji">🎨</span> **Arte sonoro**
- <span class="emoji">📱</span> **Diseño interactivo** 
- <span class="emoji">🔬</span> **Bioacústica científica**

</div>

### <span class="emoji">✨</span> *Transformando la experiencia del mundo sonoro*

---

# <span class="emoji">🚀</span> **Funcionalidades Principales**

## <span class="emoji">🎙️</span> **Grabación Geolocalizada**
- Audio de alta calidad + GPS preciso
- Seguimiento con breadcrumbs en tiempo real
- Metadatos científicos (especie, clima, temperatura)

## <span class="emoji">🗺️</span> **Modos de Escucha Avanzados**
- **NearBy**: Audio espacializado con panning L/R
- **Jamm**: Reproducción simultánea mezclada
- **Concatenated**: Secuencia con crossfades

## <span class="emoji">📊</span> **Exportación Profesional**
- ZIP con audio + metadatos JSON
- Sistema freemium (10 grabaciones)

---

# <span class="emoji">⚙️</span> **Innovación Técnica**

<div class="highlight">

## <span class="emoji">🔊</span> **Audio Espacializado**
- **Web Audio API** para procesamiento real-time
- Cálculo geográfico de bearing para panning estéreo
- Control de volumen por proximidad

## <span class="emoji">📱</span> **UX/UI Nativo**
- Capacitor Android optimizado
- Modales personalizados sin localhost
- Indicadores visuales de duración

## <span class="emoji">🧭</span> **Geoespacial Avanzado**
- Leaflet.js + múltiples capas de mapa
- Breadcrumbs automáticos durante grabación

</div>

---

# <span class="emoji">🎨</span> **Arte Sonoro + Bioacústica**

## <span class="emoji">🎭</span> **Para Artistas**
- **Deriva psicogeográfica**: Paisajes urbanos/naturales
- **Composición espacial**: Experiencias inmersivas
- **Performance site-specific**: Reproducción contextual

## <span class="emoji">🔬</span> **Para Científicos**
- **Monitoreo biodiversidad**: Registro sistemático fauna
- **Documentación rigurosa**: Metadatos completos
- **Ciencia participativa**: Colaboración ciudadana

## <span class="emoji">🌍</span> **Impacto Interdisciplinario**
- Ecología acústica • Antropología sonora
- Urbanismo sensorial • Educación ambiental

---

# <span class="emoji">🚀</span> **Visión Futura**

<div class="center">

## <span class="emoji">🔮</span> **Roadmap 2024-2025**

</div>

<div class="highlight">

### <span class="emoji">🤖</span> **IA + Machine Learning**
Identificación automática de especies

### <span class="emoji">🌐</span> **Red Colaborativa**
Plataforma comunitaria global

### <span class="emoji">🥽</span> **Realidad Aumentada**
Visualización 3D de paisajes sonoros

</div>

## <span class="emoji">🎯</span> **Valor Único**
- Primera app arte sonoro + ciencia rigurosa
- Open source • Multiplataforma • Escalable

---

<div class="center">

# <span class="emoji">📞</span> **Contacto & Recursos**

<div class="highlight">

## <span class="emoji">🌐</span> **GitHub**: github.com/alejoduque/BioMapp
## <span class="emoji">📱</span> **APK**: Disponible para testing
## <span class="emoji">📚</span> **Código**: Open Source

</div>

<br>

### <span class="emoji">🎵</span> *"Cada paisaje sonoro cuenta una historia.*
### *SoundWalk Recorder te ayuda a escucharla,*
### *capturarla y compartirla."*

</div>