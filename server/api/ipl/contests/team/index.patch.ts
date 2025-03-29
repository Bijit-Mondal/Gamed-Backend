import { and, eq, sql } from "drizzle-orm";
import { defineEventHandler, readBody } from "h3";
import { db } from "../../../../db";
import { matches, players, squad, userTeamPlayers, userTeams } from "../../../../db/schema";
import { z } from "zod";

// Validation schema for fantasy team update
const updateTeamSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  userId: z.string().min(1, "User ID is required"),
  teamName: z.string().min(3, "Team name must be at least 3 characters").optional(),
  players: z.array(
    z.object({
      playerId: z.string().min(1, "Player ID is required"),
      isCaptain: z.boolean().default(false),
      isViceCaptain: z.boolean().default(false),
    })
  ).length(11, "Team must have exactly 11 players").optional(),
});

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);

    // Validate request body
    const validationResult = updateTeamSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      };
    }

    const updateData = validationResult.data;

    // Check if team exists and belongs to the user
    const teamExists = await db
      .select({
        teamId: userTeams.teamId,
        matchId: userTeams.matchId,
        userId: userTeams.userId,
        teamName: userTeams.teamName,
      })
      .from(userTeams)
      .where(
        and(
          eq(userTeams.teamId, updateData.teamId),
          eq(userTeams.userId, updateData.userId)
        )
      )
      .limit(1);

    if (!teamExists.length) {
      return {
        success: false,
        message: "Team not found or doesn't belong to the user",
      };
    }

    const team = teamExists[0];

    // Check if match hasn't started yet
    const matchStatus = await db
      .select({ status: matches.matchStatus })
      .from(matches)
      .where(eq(matches.matchId, team.matchId))
      .limit(1);

    if (!matchStatus.length || matchStatus[0].status !== "UPCOMING") {
      return {
        success: false,
        message: "Cannot update team after match has started",
      };
    }

    // Prepare update operations
    const updates = [];
    const responseData: any = {
      teamId: team.teamId,
    };

    // Update team name if provided
    if (updateData.teamName && updateData.teamName !== team.teamName) {
      await db
        .update(userTeams)
        .set({ teamName: updateData.teamName })
        .where(eq(userTeams.teamId, team.teamId));
      
      responseData.teamName = updateData.teamName;
      updates.push("Team name updated");
    }

    // Update players if provided
    if (updateData.players) {
      // Get match details to check home and away teams
      const matchDetails = await db
        .select({
          matchId: matches.matchId,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(matches)
        .where(eq(matches.matchId, team.matchId))
        .limit(1);

      if (!matchDetails.length) {
        return {
          success: false,
          message: "Match not found",
        };
      }

      const match = matchDetails[0];
      
      // Validate the players selected
      const playerIds = updateData.players.map((player) => player.playerId);
      
      // Check if all players exist and are in active squads for the match teams
      const selectedPlayers = await db
        .select({
          player: {
            id: players.playerId,
            type: players.playerType,
          },
          teamId: squad.teamId,
        })
        .from(players)
        .innerJoin(squad, eq(players.playerId, squad.playerId))
        .where(
          and(
            sql`${players.playerId} IN (${playerIds.join(',')})`,
            sql`${squad.teamId} IN (${match.homeTeamId}, ${match.awayTeamId})`,
            eq(squad.isActive, true)
          )
        );

      // Check if all 11 players were found
      if (selectedPlayers.length !== 11) {
        return {
          success: false,
          message: "One or more players are not valid for this match",
        };
      }

      // Count players by team
      const playersByTeam: Record<string, number> = {};
      selectedPlayers.forEach((p) => {
        playersByTeam[p.teamId] = (playersByTeam[p.teamId] || 0) + 1;
      });

      // Check if we have a valid distribution from both teams (max 6 from one team, min 5 from other)
      const teamIds = Object.keys(playersByTeam);
      if (
        teamIds.length !== 2 || 
        playersByTeam[teamIds[0]] > 6 || 
        playersByTeam[teamIds[1]] > 6 ||
        playersByTeam[teamIds[0]] < 5 || 
        playersByTeam[teamIds[1]] < 5
      ) {
        return {
          success: false,
          message: "Invalid team distribution. You must select at least 5 and at most 6 players from each team.",
        };
      }

      // Count players by type
      const playersByType: Record<string, number> = {};
      selectedPlayers.forEach((p) => {
        playersByType[p.player.type] = (playersByType[p.player.type] || 0) + 1;
      });

      // Check if we have at least one player of each type
      const requiredTypes = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
      const missingTypes = requiredTypes.filter(type => !playersByType[type] || playersByType[type] < 1);
      
      if (missingTypes.length > 0) {
        return {
          success: false,
          message: `Missing required player types: ${missingTypes.join(", ")}. Your team must include at least 1 of each type.`,
        };
      }

      // Check if any player type exceeds the maximum of 5
      for (const type of requiredTypes) {
        if (playersByType[type] > 5) {
          return {
            success: false,
            message: `Too many ${type} players. Maximum allowed is 5.`,
          };
        }
      }

      // Validate captain and vice-captain
      const captainCount = updateData.players.filter(p => p.isCaptain).length;
      const viceCaptainCount = updateData.players.filter(p => p.isViceCaptain).length;

      if (captainCount !== 1) {
        return {
          success: false,
          message: "You must select exactly one player as captain",
        };
      }

      if (viceCaptainCount !== 1) {
        return {
          success: false,
          message: "You must select exactly one player as vice-captain",
        };
      }

      // Check if same player is both captain and vice-captain
      const captainId = updateData.players.find(p => p.isCaptain)?.playerId;
      const viceCaptainId = updateData.players.find(p => p.isViceCaptain)?.playerId;

      if (captainId === viceCaptainId) {
        return {
          success: false,
          message: "Same player cannot be both captain and vice-captain",
        };
      }

      // Delete existing player selections
      await db
        .delete(userTeamPlayers)
        .where(eq(userTeamPlayers.userTeamId, team.teamId));

      // Insert new player selections
      for (const player of updateData.players) {
        await db.insert(userTeamPlayers).values({
          userTeamId: team.teamId,
          playerId: player.playerId,
          isCaptain: player.isCaptain,
          isViceCaptain: player.isViceCaptain,
        });
      }

      responseData.playerCount = updateData.players.length;
      updates.push("Team players updated");
    }

    if (updates.length === 0) {
      return {
        success: false,
        message: "No updates provided",
      };
    }

    return {
      success: true,
      message: "Team updated successfully",
      data: responseData,
      updates,
    };
  } catch (error: any) {
    console.error("Error updating team:", error);

    return {
      success: false,
      message: "Failed to update team",
      error: error.message,
    };
  }
});