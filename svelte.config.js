import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    // adapter-node: la app pasa a ser un proceso Node bajo pm2 en el droplet,
    // detras de nginx. NO adapter-static: aunque el sitio hoy se sirva como
    // archivos, el objetivo de migrar es poder tener codigo del lado servidor.
    adapter: adapter(),
  },
}
