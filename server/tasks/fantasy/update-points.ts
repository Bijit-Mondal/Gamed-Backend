// server/tasks/fantasy/update-points.ts
export default defineTask({
    meta: {
      name: "fantasy:update-points",
      description: "Update fantasy points for live matches",
    },
    async run({ payload, context }) {
      console.log("Running fantasy points update task...");
      
      // Call your API endpoint
      const response = await fetch("http://localhost:3000/api/ipl/contests/cronjobs/fetch");
      const result = await response.json();
      
      return { result };
    },
  });

