import { defineEventHandler, getQuery } from "h3";
import { eq, and } from "drizzle-orm";
import { db } from "../../../db";
import { squad, players, teams } from "../../../db/schema";

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

    // Check if team exists
    const teamExists = await db.select().from(teams).where(eq(teams.teamId, teamId)).limit(1);
    
    if (!teamExists.length) {
      return {
        success: false,
        message: "Team not found",
      };
    }

    // Get squad members for the team
    const squadMembers = await db
      .select({
        player: {
          id: players.playerId,
          name: players.fullName,
          country: players.country,
          type: players.playerType,
          role: players.playerRole,
          battingStyle: players.battingStyle,
          bowlingStyle: players.bowlingStyle,
          dateOfBirth: players.dateOfBirth,
          baseCreditValue: players.baseCreditValue,
        },
        team: {
          id: teams.teamId,
          name: teams.teamName,
        },
        isActive: squad.isActive,
        joinedDate: squad.joinedDate,
      })
      .from(squad)
      .innerJoin(players, eq(squad.playerId, players.playerId))
      .innerJoin(teams, eq(squad.teamId, teams.teamId))
      .where(and(
        eq(squad.teamId, teamId),
        eq(squad.isActive, true)
      ))
      .orderBy(players.playerType);

    // Group players by their role
    const groupedByRole = squadMembers.reduce((result, player) => {
      const role = player.player.type;
      if (!result[role]) {
        result[role] = [];
      }
      result[role].push(player);
      return result;
    }, {} as Record<string, typeof squadMembers>);

    return {
      success: true,
      data: {
        team: squadMembers.length > 0 ? squadMembers[0].team : teamExists[0],
        squad: {
          BATSMAN: groupedByRole.BATSMAN || [],
          BOWLER: groupedByRole.BOWLER || [],
          ALL_ROUNDER: groupedByRole.ALL_ROUNDER || [],
          WICKET_KEEPER: groupedByRole.WICKET_KEEPER || [],
        },
        totalPlayers: squadMembers.length,
      },
    };
  } catch (error: any) {
    console.error("Error fetching squad:", error);
    
    return {
      success: false,
      message: "Failed to fetch squad details",
      error: error.message,
    };
  }
});