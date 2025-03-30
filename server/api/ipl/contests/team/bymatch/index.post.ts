import { and, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { defineEventHandler, readBody } from "h3";
import { db } from "../../../../../db";
import { contests, matches, players, squad, teams, userTeamPlayers, userTeams, contestEnrollments } from "../../../../../db/schema";
import { z } from "zod";

// Validation schema for fantasy team creation
const createTeamSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  matchId: z.string().min(1, "Match ID is required"),
  contestId: z.string().min(1, "Contest ID is required"),
  teamName: z.string().min(3, "Team name must be at least 3 characters"),
  players: z.array(
    z.object({
      playerId: z.string().min(1, "Player ID is required"),
      isCaptain: z.boolean().default(false),
      isViceCaptain: z.boolean().default(false),
    })
  ).length(11, "Team must have exactly 11 players"),
});

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);

    // Validate request body
    const validationResult = createTeamSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      };
    }

    const teamData = validationResult.data;

    // Check if contest exists and is valid
    const contestExists = await db
      .select()
      .from(contests)
      .where(eq(contests.contestId, teamData.contestId))
      .limit(1);

    if (!contestExists.length) {
      return {
        success: false,
        message: "Contest not found",
      };
    }

    // Check if the contest is for the specified match
    if (contestExists[0].matchId !== teamData.matchId) {
      return {
        success: false,
        message: "Contest is not for the specified match",
      };
    }

    // Check if match exists and is upcoming
    const matchExists = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.matchId, teamData.matchId),
          eq(matches.matchStatus, "UPCOMING")
        )
      )
      .limit(1);

    if (!matchExists.length) {
      return {
        success: false,
        message: "Match not found or is not upcoming",
      };
    }

    // Get the match details to check home and away teams
    const match = matchExists[0];

    console.log("Match Details:", match);
    
    // Validate the players selected
    const playerIds = teamData.players.map((player) => player.playerId);

    console.log("Player IDs:", playerIds);
    
    // Check if all players exist and are in active squads for the match teams
    // const selectedPlayers = await db
    //   .select({
    //     player: {
    //       id: players.playerId,
    //       // type: players.playerType,
    //     },
    //     teamId: squad.teamId,
    //   })
    //   .from(players)
    //   .innerJoin(squad, eq(players.playerId, squad.playerId))
    //   .where(
    //     and(
    //       sql`${players.playerId} IN (${playerIds.join(', ')})`,
    //       sql`${squad.teamId} IN (${match.homeTeamId}, ${match.awayTeamId})`,
    //       eq(squad.isActive, true)
    //     )
    //   );

    //   console.log("Selected Players:", selectedPlayers);

    // // Check if all 11 players were found
    // if (selectedPlayers.length !== 11) {
    //   return {
    //     success: false,
    //     message: "One or more players are not valid for this match",
    //   };
    // }

    // Count players by team
    // const playersByTeam: Record<string, number> = {};
    // selectedPlayers.forEach((p) => {
    //   playersByTeam[p.teamId] = (playersByTeam[p.teamId] || 0) + 1;
    // });

    // // Check if we have a valid distribution from both teams (max 6 from one team, min 5 from other)
    // const teamIds = Object.keys(playersByTeam);
    // if (
    //   teamIds.length !== 2 || 
    //   playersByTeam[teamIds[0]] > 6 || 
    //   playersByTeam[teamIds[1]] > 6 ||
    //   playersByTeam[teamIds[0]] < 5 || 
    //   playersByTeam[teamIds[1]] < 5
    // ) {
    //   return {
    //     success: false,
    //     message: "Invalid team distribution. You must select at least 5 and at most 6 players from each team.",
    //   };
    // }

    // // Count players by type
    // const playersByType: Record<string, number> = {};
    // selectedPlayers.forEach((p) => {
    //   playersByType[p.player.type] = (playersByType[p.player.type] || 0) + 1;
    // });

    // Check if we have at least one player of each type
    // const requiredTypes = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
    // const missingTypes = requiredTypes.filter(type => !playersByType[type] || playersByType[type] < 1);
    
    // if (missingTypes.length > 0) {
    //   return {
    //     success: false,
    //     message: `Missing required player types: ${missingTypes.join(", ")}. Your team must include at least 1 of each type.`,
    //   };
    // }

    // Check if any player type exceeds the maximum of 5
    // for (const type of requiredTypes) {
    //   if (playersByType[type] > 5) {
    //     return {
    //       success: false,
    //       message: `Too many ${type} players. Maximum allowed is 5.`,
    //     };
    //   }
    // }

    // Validate captain and vice-captain
    const captainCount = teamData.players.filter(p => p.isCaptain).length;
    const viceCaptainCount = teamData.players.filter(p => p.isViceCaptain).length;

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
    const captainId = teamData.players.find(p => p.isCaptain)?.playerId;
    const viceCaptainId = teamData.players.find(p => p.isViceCaptain)?.playerId;

    if (captainId === viceCaptainId) {
      return {
        success: false,
        message: "Same player cannot be both captain and vice-captain",
      };
    }

    // Create the user team
    const teamId = uuidv4();
    
    await db.insert(userTeams).values({
      teamId,
      userId: teamData.userId,
      matchId: teamData.matchId,
      teamName: teamData.teamName,
      totalPoints: "0", // Initial points
      createdAt: new Date().toISOString(),
    });

    // Insert all players into the user team
    for (const player of teamData.players) {
      await db.insert(userTeamPlayers).values({
        userTeamId: teamId,
        playerId: player.playerId,
        isCaptain: player.isCaptain,
        isViceCaptain: player.isViceCaptain,
      });
    }

    // Enroll the team in the contest
    const enrollmentId = uuidv4();
    let res = await db.insert(contestEnrollments).values({
      enrollmentId,
      contestId: teamData.contestId,
      userTeamId: teamId,
      userId: teamData.userId,
      enrollmentTime: new Date().toISOString(),
      status: "ACTIVE",
    });
    console.log(res, "res")

    let s = await db.select({
      enrollmentId: contestEnrollments.enrollmentId,
      contestId: contestEnrollments.contestId,
      userTeamId: contestEnrollments.userTeamId,
      userId: contestEnrollments.userId,
      enrollmentTime: contestEnrollments.enrollmentTime,
      status: contestEnrollments.status,
    }).from(contestEnrollments).where(
      eq(contestEnrollments.enrollmentId, enrollmentId)
    );
    console.log(s, "s")
    // Check if the enrollment was successful

    // Update the filledSpots counter in the contest
    const contest = await db
      .select({ filledSpots: contests.filledSpots })
      .from(contests)
      .where(eq(contests.contestId, teamData.contestId))
      .limit(1);

    
    const currentFilledSpots = contest[0]?.filledSpots || 0;
    
    await db
      .update(contests)
      .set({
        filledSpots: currentFilledSpots + 1,
      })
      .where(eq(contests.contestId, teamData.contestId));

    return {
      success: true,
      message: "Team created successfully and enrolled in contest",
      data: {
        teamId,
        teamName: teamData.teamName,
        matchId: teamData.matchId,
        contestId: teamData.contestId,
        playerCount: teamData.players.length,
        enrollmentId,
      },
    };
  } catch (error: any) {
    console.error("Error creating team:", error);

    return {
      success: false,
      message: "Failed to create team",
      error: error.message,
    };
  }
});