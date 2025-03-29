import { defineEventHandler, getQuery } from "h3";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db";
import { userTeams, userTeamPlayers, players, matches, teams, contestEnrollments, contests, squad } from "../../../../db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Get team ID from query parameter
    const query = getQuery(event) as Record<string, string>;
    const rawTeamId = query.teamId;
    // Clean up the teamId to handle potential whitespace or encoding issues
    const teamId = rawTeamId ? rawTeamId.trim() : '';
    console.log("Looking for teamId:", teamId, "Type:", typeof teamId);

    if (!teamId) {
      return {
        success: false,
        message: "Team ID is required",
      };
    }

    // Get team details from teams table (not userTeams)
    const teamDetails = await db
      .select({
        teamId: teams.teamId,
        teamName: teams.teamName,
        country: teams.country,
        logoUrl: teams.logoUrl,
        teamType: teams.teamType
      })
      .from(teams)
      .where(eq(teams.teamId, teamId))
      .limit(1);

    if (!teamDetails.length) {
      return {
        success: false,
        message: "Team not found",
      };
    }

    const team = teamDetails[0];

      return {
        success: true,
        data: {
          team,
        },
      };
    
  } catch (error: any) {
    console.error("Error fetching team details:", error);
    
    return {
      success: false,
      message: "Failed to fetch team details",
      error: error.message,
    };
  }
});