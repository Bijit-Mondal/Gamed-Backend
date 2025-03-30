import { defineEventHandler, getQuery } from "h3";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import { contests, contestEnrollments, matches, userTeams, users, teams } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Get user ID from query parameter
    const query = getQuery(event) as Record<string, string>;
    const userId = query.userId;

    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    // Check if user exists
    // const userExists = await db
    //   .select({ id: users.id })
    //   .from(users)
    //   .where(eq(users.id, parseInt(userId)))
    //   .limit(1);

    // if (!userExists.length) {
    //   return {
    //     success: false,
    //     message: "User not found",
    //   };
    // }

    // Get all contest enrollments for the user with contest, match and team details
    const userContests = await db
      .select({
        enrollment: contestEnrollments,
        contest: contests,
        match: matches,
        userTeam: userTeams
      })
      .from(contestEnrollments)
      .innerJoin(contests, eq(contestEnrollments.contestId, contests.contestId))
      .innerJoin(matches, eq(contests.matchId, matches.matchId))
      .innerJoin(userTeams, eq(contestEnrollments.userTeamId, userTeams.teamId))
      .where(eq(contestEnrollments.userId, (userId)))
      .orderBy(desc(contests.startTime));

    // Group contests by status (UPCOMING, LIVE, COMPLETED)
    const groupedContests = userContests.reduce((result, item) => {
      const status = item.match.matchStatus;
      if (!result[status]) {
        result[status] = [];
      }
      result[status].push(item);
      return result;
    }, {} as Record<string, typeof userContests>);

    // Ensure all match status types are present in the response
    const matchStatusTypes = ["UPCOMING", "LIVE", "COMPLETED", "CANCELED"];
    const groupedResult: Record<string, any[]> = {};
    
    matchStatusTypes.forEach(type => {
      groupedResult[type] = groupedContests[type] || [];
    });

    return {
      success: true,
      data: {
        userId: parseInt(userId),
        totalContests: userContests.length,
        contests: groupedResult
      },
    };
  } catch (error: any) {
    console.error("Error fetching user contests:", error);
    
    return {
      success: false,
      message: "Failed to fetch user contests",
      error: error.message,
    };
  }
});