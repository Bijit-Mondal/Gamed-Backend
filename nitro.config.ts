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
    //  '* * * * *': ['fantasy:update-points', 'fantasy:update-points-scorecard']
     '* * * * *': ['fantasy:update-points']
  },
  openAPI: {
    ui: {
      scalar: {
        darkMode: true,
        theme: 'yellow'
      }
    }
  },
  output: {
    dir: 'dist',
    publicDir: 'dist/public',
    serverDir: 'dist/server'
  }
});
