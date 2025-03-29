import { defineEventHandler } from "h3";
import { and, eq, gte } from "drizzle-orm";
import { db } from "../../../../db";
import { matches, teams } from "../../../../db/schema";

export default defineEventHandler(async () => {
  try {
    // Get current date in ISO format
    const currentDate = new Date().toISOString();

    // Fetch all upcoming matches
    const upcomingMatches = await db
      .select({
        matchId: matches.matchId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        matchDate: matches.matchDate,
        venue: matches.venue,
        matchStatus: matches.matchStatus,
        matchType: matches.matchType,
      })
      .from(matches)
      .where(
        and(
          eq(matches.matchStatus, "UPCOMING"),
          gte(matches.matchDate, currentDate)
        )
      )
      .orderBy(matches.matchDate);

    // If no upcoming matches found
    if (!upcomingMatches.length) {
      return {
        success: true,
        data: {
          matches: [],
          count: 0,
        },
      };
    }

    // Get all team IDs from the upcoming matches
    const teamIds = [
      ...new Set([
        ...upcomingMatches.map((match) => match.homeTeamId),
        ...upcomingMatches.map((match) => match.awayTeamId),
      ]),
    ].filter(Boolean);

    // Fetch team details for all teams involved in upcoming matches
    const teamsData = await db
      .select({
        teamId: teams.teamId,
        teamName: teams.teamName,
        logoUrl: teams.logoUrl,
        country: teams.country,
      })
      .from(teams)
      .where(
        teams.teamId.in(teamIds)
      );

    // Create a map of team ID to team details for easy lookup
    const teamsMap = teamsData.reduce((acc, team) => {
      acc[team.teamId] = team;
      return acc;
    }, {} as Record<string, typeof teamsData[0]>);

    // Enrich match data with team details
    const matchesWithTeams = upcomingMatches.map((match) => {
      return {
        ...match,
        homeTeam: teamsMap[match.homeTeamId] || null,
        awayTeam: teamsMap[match.awayTeamId] || null,
        formattedDate: new Date(match.matchDate).toLocaleString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        }),
      };
    });

    return {
      success: true,
      data: {
        matches: matchesWithTeams,
        count: matchesWithTeams.length,
      },
    };
  } catch (error: any) {
    console.error("Error fetching upcoming matches:", error);
    
    return {
      success: false,
      message: "Failed to fetch upcoming matches",
      error: error.message,
    };
  }
});