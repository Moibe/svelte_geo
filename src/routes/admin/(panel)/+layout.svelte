<script>
  let { children, data } = $props()
</script>

<div class="panel">
  <div class="barra">
    <span class="marca">geoservices</span>
    <span class="quien">{data.usuario?.usuario}</span>
  </div>
  {@render children()}
</div>

<style>
  .panel {
    min-height: 100vh;
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
    color: #fff;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
  }

  .barra {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.12);
  }

  .marca {
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .quien {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
  }
</style>
