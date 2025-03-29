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

    // Get matches for this team (as either home or away team)
    const matchDetails = await db
      .select({
        matchId: matches.matchId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        matchDate: matches.matchDate,
        matchStatus: matches.matchStatus,
        venue: matches.venue,
      })
      .from(matches)
      .where(
        sql`${matches.homeTeamId} = ${teamId} OR ${matches.awayTeamId} = ${teamId}`
      )
      .orderBy(matches.matchDate);

    // Get squad players for this team using proper join syntax with the squad table
    const teamPlayers = await db
      .select({
        playerId: players.playerId,
        playerName: players.fullName,
        playerType: players.playerType,
        country: players.country,
        battingStyle: players.battingStyle,
        bowlingStyle: players.bowlingStyle,
        creditValue: players.baseCreditValue,
      })
      .from(players)
      .innerJoin(squad, eq(players.playerId, squad.playerId))
      .where(
        and(
          eq(squad.teamId, teamId),
          eq(squad.isActive, true)
        )
      );

    if (!teamPlayers.length) {
      // Return team info without players if no players found
      return {
        success: true,
        data: {
          team,
          matches: matchDetails,
          players: {
            count: 0,
            all: []
          }
        },
      };
    }

    // Group players by player type for better organization
    const groupedPlayers = teamPlayers.reduce((result, player) => {
      const type = player.playerType;
      if (!result[type]) {
        result[type] = [];
      }
      result[type].push(player);
      return result;
    }, {} as Record<string, typeof teamPlayers>);

    // Ensure all player types are present in the response
    const playerTypes = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
    const groupedResult: Record<string, any[]> = {};
    
    playerTypes.forEach(type => {
      groupedResult[type] = groupedPlayers[type] || [];
    });

    return {
      success: true,
      data: {
        team,
        matches: matchDetails,
        players: {
          count: teamPlayers.length,
          byType: groupedResult,
          all: teamPlayers
        }
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