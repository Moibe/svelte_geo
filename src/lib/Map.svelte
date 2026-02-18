<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';

  export let lat = 19.4326; // Default CDMX lat
  export let lng = -99.1332; // Default CDMX lng

  let mapContainer;
  let map;

  onMount(() => {
    const coords = [lat, lng];

    // Crear el mapa
    map = L.map(mapContainer).setView(coords, 17);

    // Agregar tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Agregar marcador
    L.marker(coords).addTo(map).bindPopup('Tu ubicación');
  });
</script>

<div class="map-container" bind:this={mapContainer}></div>

<style>
  :global(.leaflet-container) {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }

  .map-container {
    width: 100%;
    height: 500px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #90caf9;
    box-sizing: border-box;
  }
</style>
