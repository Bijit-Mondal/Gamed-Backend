import { defineEventHandler, getQuery } from "h3";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { userTeams, userTeamPlayers, players, matches, teams } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Get team ID from query parameter
    const query = getQuery(event) as Record<string, string>;
    const teamId = query.teamId;

    if (!teamId) {
      return {
        success: false,
        message: "Team ID is required",
      };
    }

    // Get team details
    const teamDetails = await db
      .select({
        teamId: userTeams.teamId,
        userId: userTeams.userId,
        matchId: userTeams.matchId,
        teamName: userTeams.teamName,
        totalPoints: userTeams.totalPoints,
        createdAt: userTeams.createdAt,
      })
      .from(userTeams)
      .where(eq(userTeams.teamId, teamId))
      .limit(1);

    if (!teamDetails.length) {
      return {
        success: false,
        message: "Team not found",
      };
    }

    const team = teamDetails[0];

    // Get match details
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
      .where(eq(matches.matchId, team.matchId))
      .limit(1);

    // Get team information
    const matchTeams = await db
      .select({
        teamId: teams.teamId,
        teamName: teams.teamName,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .where(
        team.matchId 
          ? and(eq(teams.teamId, matchDetails[0]?.homeTeamId), eq(teams.teamId, matchDetails[0]?.awayTeamId)) 
          : eq(teams.teamId, "")
      );

    const homeTeam = matchTeams.find((t) => t.teamId === matchDetails[0]?.homeTeamId);
    const awayTeam = matchTeams.find((t) => t.teamId === matchDetails[0]?.awayTeamId);

    // Get team players with detailed information
    const teamPlayerDetails = await db
      .select({
        playerId: players.playerId,
        playerName: players.fullName,
        playerType: players.playerType,
        country: players.country,
        battingStyle: players.battingStyle,
        bowlingStyle: players.bowlingStyle,
        creditValue: players.baseCreditValue,
        isCaptain: userTeamPlayers.isCaptain,
        isViceCaptain: userTeamPlayers.isViceCaptain,
      })
      .from(userTeamPlayers)
      .innerJoin(players, eq(userTeamPlayers.playerId, players.playerId))
      .where(eq(userTeamPlayers.userTeamId, teamId));

    if (!teamPlayerDetails.length) {
      return {
        success: false,
        message: "No players found for this team",
      };
    }

    // Group players by player type for better organization
    const groupedPlayers = teamPlayerDetails.reduce((result, player) => {
      const type = player.playerType;
      if (!result[type]) {
        result[type] = [];
      }
      result[type].push(player);
      return result;
    }, {} as Record<string, typeof teamPlayerDetails>);

    // Ensure all player types are present in the response
    const playerTypes = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
    const groupedResult: Record<string, any[]> = {};
    
    playerTypes.forEach(type => {
      groupedResult[type] = groupedPlayers[type] || [];
    });

    // Get captain and vice-captain
    const captain = teamPlayerDetails.find(player => player.isCaptain);
    const viceCaptain = teamPlayerDetails.find(player => player.isViceCaptain);

    return {
      success: true,
      data: {
        team: {
          ...team,
          match: matchDetails[0] || null,
          homeTeam,
          awayTeam,
        },
        players: {
          count: teamPlayerDetails.length,
          captain: captain || null,
          viceCaptain: viceCaptain || null,
          byType: groupedResult,
          all: teamPlayerDetails,
        },
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