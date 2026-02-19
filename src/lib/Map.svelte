<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import L from 'leaflet';

  export let lat = 19.4326; // Default CDMX lat
  export let lng = -99.1332; // Default CDMX lng

  let mapContainer;
  let map;
  
  // Función para generar puntos aleatorios alrededor del principal
  function generateRandomPoints(centerLat, centerLng, count = 8) {
    const points = [];
    const colors = ['#e74c3c', '#f1c40f', '#27ae60']; // rojo, amarillo, verde
    
    for (let i = 0; i < count; i++) {
      // Radio pequeño para mantener visibilidad en zoom 17 (aprox 500m)
      const radius = 0.004; 
      const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5; // Distribución circular con variación
      const distance = Math.random() * radius + 0.001; // Distancia variable
      
      const newLat = centerLat + (distance * Math.cos(angle));
      const newLng = centerLng + (distance * Math.sin(angle));
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      points.push({ lat: newLat, lng: newLng, color });
    }
    
    return points;
  }
  
  // Función para crear íconos de colores personalizados (antenas)
  function createAntennaIcon(color) {
    return L.divIcon({
      className: 'antenna-marker',
      html: `<div style="
        position: relative;
        width: 24px;
        height: 24px;
      ">
        <!-- Torre de antena -->
        <div style="
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 16px;
          background-color: ${color};
          border-radius: 1.5px;
        "></div>
        <!-- Antenas horizontales -->
        <div style="
          position: absolute;
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 2px;
          background-color: ${color};
        "></div>
        <div style="
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 2px;
          background-color: ${color};
        "></div>
        <!-- Base circular -->
        <div style="
          position: absolute;
          bottom: 0px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 4px;
          background-color: ${color};
          border-radius: 4px 4px 0 0;
          border: 1px solid white;
        "></div>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 22]
    });
  }

  // Función para crear ícono de dispositivo móvil
  function createPhoneIcon() {
    return L.divIcon({
      className: 'phone-marker',
      html: `<div style="
        position: relative;
        width: 32px;
        height: 32px;
      ">
        <!-- Cuerpo del teléfono -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 22px;
          height: 30px;
          background-color: #4A90E2;
          border-radius: 5px;
          border: 2px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        "></div>
        <!-- Pantalla -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -58%);
          width: 16px;
          height: 18px;
          background-color: #87CEEB;
          border-radius: 2px;
        "></div>
        <!-- Botón home -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -25%);
          width: 5px;
          height: 5px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  }

  onMount(() => {
    const coords = [lat, lng];

    // Crear el mapa
    map = L.map(mapContainer).setView(coords, 17);

    // Agregar tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Agregar marcador principal (dispositivo móvil)
    const phoneIcon = createPhoneIcon();
    L.marker(coords, { icon: phoneIcon }).addTo(map).bindPopup('📱 Tu dispositivo móvil');
    
    // Generar y agregar antenas de colores
    const randomPoints = generateRandomPoints(lat, lng);
    randomPoints.forEach((point, index) => {
      const antennaIcon = createAntennaIcon(point.color);
      L.marker([point.lat, point.lng], { icon: antennaIcon })
        .addTo(map)
        .bindPopup(`📡 Torre de antena ${index + 1}`);
    });
  });
</script>

<div class="map-container" bind:this={mapContainer}>
  <!-- Leyenda dentro del mapa -->
  <div class="map-legend">
    <div class="legend-title">{$_('map.deviceFound')}</div>
    <div class="legend-item">
      <div class="legend-icon">
        <!-- Ícono del dispositivo móvil -->
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 14px;
            height: 18px;
            background-color: #4A90E2;
            border-radius: 3px;
            border: 1px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -58%);
            width: 10px;
            height: 12px;
            background-color: #87CEEB;
            border-radius: 1px;
          "></div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -25%);
            width: 3px;
            height: 3px;
            background-color: white;
            border-radius: 50%;
          "></div>
        </div>
      </div>
      <span class="legend-text">{$_('map.device')}</span>
    </div>
    
    <div class="legend-item">
      <div class="legend-icon">
        <!-- Ícono de antena -->
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
        ">
          <div style="
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 2px;
            height: 12px;
            background-color: #e74c3c;
            border-radius: 1px;
          "></div>
          <div style="
            position: absolute;
            top: 3px;
            left: 50%;
            transform: translateX(-50%);
            width: 10px;
            height: 1px;
            background-color: #e74c3c;
          "></div>
          <div style="
            position: absolute;
            top: 6px;
            left: 50%;
            transform: translateX(-50%);
            width: 6px;
            height: 1px;
            background-color: #e74c3c;
          "></div>
          <div style="
            position: absolute;
            bottom: 0px;
            left: 50%;
            transform: translateX(-50%);
            width: 6px;
            height: 3px;
            background-color: #e74c3c;
            border-radius: 3px 3px 0 0;
            border: 1px solid white;
          "></div>
        </div>
      </div>
      <span class="legend-text">{$_('map.antenna')}</span>
    </div>
  </div>
</div>

<div class="location-text">
  {$_('map.currentPosition')} <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
</div>

<style>
  :global(.leaflet-container) {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }

  .map-container {
    width: 100%;
    height: 600px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #90caf9;
    box-sizing: border-box;
    position: relative;
  }

  .map-legend {
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #e0e0e0;
    min-width: 180px;
    width: 200px;
    z-index: 1000;
  }

  .legend-title {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
    text-align: center;
    border-bottom: 1px solid #eee;
    padding-bottom: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    gap: 8px;
  }

  .legend-item:last-child {
    margin-bottom: 0;
  }

  .legend-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .legend-text {
    font-size: 11px;
    color: #555;
    font-weight: 500;
  }

  .location-text {
    color: white;
    margin-top: 12px;
    margin-left: 16px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 500;
  }

  .dot {
    animation: blink 1.4s infinite;
    opacity: 0;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  .dot:nth-child(4) {
    animation-delay: 0.6s;
  }

  @keyframes blink {
    0%, 20% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
