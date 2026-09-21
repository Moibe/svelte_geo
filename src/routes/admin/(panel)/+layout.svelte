<script>
  import { page } from '$app/state'

  let { children, data } = $props()

  const enlaces = [
    { href: '/admin', texto: 'Flags' },
    { href: '/admin/me', texto: 'Mi cuenta' },
  ]
</script>

<div class="panel">
  <div class="barra">
    <span class="marca">geoservices</span>

    <nav>
      {#each enlaces as enlace (enlace.href)}
        <a href={enlace.href} class:activo={page.url.pathname === enlace.href}>
          {enlace.texto}
        </a>
      {/each}
    </nav>

    <div class="derecha">
      <span class="quien">{data.usuario?.usuario}</span>
      <form method="POST" action="/admin/logout">
        <button class="salir" type="submit">Salir</button>
      </form>
    </div>
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

  nav {
    display: flex;
    gap: 0.35rem;
  }

  nav a {
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;
    font-size: 0.88rem;
  }

  nav a:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  nav a.activo {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    font-weight: 600;
  }

  .derecha {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .salir {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    font-size: 0.82rem;
  }

  .salir:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 560px) {
    .barra {
      flex-wrap: wrap;
      gap: 0.6rem;
    }
  }
</style>
