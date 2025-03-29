//https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: "server",
  compatibilityDate: "2025-02-03",
  experimental: {
    openAPI: true
  },
  openAPI: {
    ui: {
      scalar: {
        darkMode: true,
        theme: 'yellow'
      }
    }
  },
  routeRules:{
    '/api/**': { cors: true, headers: {'access-control-allow-methods': 'GET,POST,OPTIONS,PUT,DELETE,PATCH','access-control-allow-origin':'http://localhost:5173','access-control-allow-headers':'Content-Type,Authorization' } },
  }
});