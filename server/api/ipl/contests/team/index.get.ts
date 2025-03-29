import { defineEventHandler, getQuery } from "h3";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db";
import { userTeams, userTeamPlayers, players, matches, teams, contestEnrollments, contests } from "../../../../db/schema";

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

    if (!matchDetails.length) {
      return {
        success: false,
        message: "Match not found for this team",
      };
    }

    const match = matchDetails[0];

    // Get team information for both home and away teams
    const matchTeams = await db
      .select({
        teamId: teams.teamId,
        teamName: teams.teamName,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .where(
        sql`${teams.teamId} IN (${match.homeTeamId}, ${match.awayTeamId})`
      );

    const homeTeam = matchTeams.find((t) => t.teamId === match.homeTeamId);
    const awayTeam = matchTeams.find((t) => t.teamId === match.awayTeamId);

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

    // Get contests this team is enrolled in
    const enrollments = await db
      .select({
        enrollmentId: contestEnrollments.enrollmentId,
        contestId: contestEnrollments.contestId,
        status: contestEnrollments.status,
        enrollmentTime: contestEnrollments.enrollmentTime,
        rank: contestEnrollments.rank,
        winnings: contestEnrollments.winnings,
      })
      .from(contestEnrollments)
      .where(eq(contestEnrollments.userTeamId, teamId));

    // Get contest details if there are enrollments
    let contestDetails = [];
    if (enrollments.length > 0) {
      const contestIds = enrollments.map(e => e.contestId);
      contestDetails = await db
        .select({
          contestId: contests.contestId,
          contestName: contests.contestName,
          totalSpots: contests.totalSpots,
          filledSpots: contests.filledSpots,
          entryFee: contests.entryFee,
          totalPrizePool: contests.totalPrizePool,
          contestType: contests.contestType,
          status: contests.status,
        })
        .from(contests)
        .where(sql`${contests.contestId} IN (${contestIds.join(',')})`);
    }

    // Merge enrollment and contest details
    const contestsWithEnrollments = enrollments.map(enrollment => {
      const contestDetail = contestDetails.find(c => c.contestId === enrollment.contestId);
      return {
        ...enrollment,
        contest: contestDetail || null
      };
    });

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
          match: match || null,
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
        contests: {
          count: contestsWithEnrollments.length,
          enrollments: contestsWithEnrollments,
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