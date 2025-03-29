import { defineEventHandler, getQuery } from "h3";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { contests, matches } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Get match ID from query parameter
    const query = getQuery(event) as Record<string, string>;
    const matchId = query.matchId;

    if (!matchId) {
      return {
        success: false,
        message: "Match ID is required",
      };
    }

    // Check if match exists
    const matchExists = await db
      .select({ matchId: matches.matchId })
      .from(matches)
      .where(eq(matches.matchId, matchId))
      .limit(1);

    if (!matchExists.length) {
      return {
        success: false,
        message: "Match not found",
      };
    }

    // Get all contests for the match
    const matchContests = await db
      .select()
      .from(contests)
      .where(eq(contests.matchId, matchId))
      .orderBy(contests.contestType, contests.entryFee);

    if (!matchContests.length) {
      return {
        success: true,
        message: "No contests found for this match",
        data: {
          MEGA: [],
          HEAD_TO_HEAD: [],
          PRACTICE: [],
          PREMIUM: [],
        },
      };
    }

    // Group contests by contestType
    const groupedContests = matchContests.reduce((result, contest) => {
      const type = contest.contestType;
      if (!result[type]) {
        result[type] = [];
      }
      result[type].push(contest);
      return result;
    }, {} as Record<string, typeof matchContests>);

    // Ensure all contest types are present in the response
    const contestTypes = ["MEGA", "HEAD_TO_HEAD", "PRACTICE", "PREMIUM"];
    const groupedResult: Record<string, any[]> = {};
    
    contestTypes.forEach(type => {
      groupedResult[type] = groupedContests[type] || [];
    });

    return {
      success: true,
      data: {
        match: matchExists[0],
        contestsCount: matchContests.length,
        contests: groupedResult
      },
    };
  } catch (error: any) {
    console.error("Error fetching contests:", error);
    
    return {
      success: false,
      message: "Failed to fetch contests",
      error: error.message,
    };
  }
});