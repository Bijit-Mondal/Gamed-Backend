// server/tasks/fantasy/update-points-scorecard.ts
export default defineTask({
  meta: {
    name: "fantasy:update-points-scorecard",
    description: "Update fantasy points for live matches using complete scorecard data",
  },
  async run({ payload, context }) {
    console.log("Running fantasy points update from scorecard task...");
    
    // Call your API endpoint
    const response = await fetch("http://localhost:3000/api/ipl/contests/cronjobs/fetch-scorecard");
    const result = await response.json();
    
    return { result };
  },
});
