//https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: "server",
  compatibilityDate: "2025-02-03",
  experimental: {
    openAPI: true,
    tasks: true
  },
  scheduledTasks: {
    // Run fantasy tasks every minute
     '* * * * *': ['fantasy:update-points', 'fantasy:update-points-scorecard']
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
