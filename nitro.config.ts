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
  }
});