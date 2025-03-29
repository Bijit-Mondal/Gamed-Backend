import { eq, and } from "drizzle-orm";
import { db } from "../../../db";
import { contests, contestEnrollments, userTeams, users } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  try {
    // Get contest ID from the URL parameter
    const query = getQuery(event) as Record<string, string>;
    const contestId = query.contestId;
    
    if (!contestId) {
      return {
        success: false,
        message: "Contest ID is required",
      };
    }

    // Check if contest exists
    const contestDetails = await db
      .select({
        contestId: contests.contestId,
        contestName: contests.contestName,
        matchId: contests.matchId,
        totalSpots: contests.totalSpots,
        filledSpots: contests.filledSpots,
        entryFee: contests.entryFee,
        totalPrizePool: contests.totalPrizePool,
        contestType: contests.contestType,
        status: contests.status,
      })
      .from(contests)
      .where(eq(contests.contestId, contestId))
      .limit(1);

    if (!contestDetails.length) {
      return {
        success: false,
        message: "Contest not found",
      };
    }

    const contest = contestDetails[0];

    // Get all enrollments for this contest
    const enrollments = await db
      .select({
        enrollmentId: contestEnrollments.enrollmentId,
        userTeamId: contestEnrollments.userTeamId,
        userId: contestEnrollments.userId,
        enrollmentTime: contestEnrollments.enrollmentTime,
        status: contestEnrollments.status,
        rank: contestEnrollments.rank,
        winnings: contestEnrollments.winnings,
      })
      .from(contestEnrollments)
      .where(eq(contestEnrollments.contestId, contestId));

    if (!enrollments.length) {
      return {
        success: true,
        data: {
          contest,
          enrollments: [],
          enrollmentCount: 0,
        },
      };
    }

    // Get basic team information (without player details)
    const teamIds = enrollments.map(enrollment => enrollment.userTeamId);
    const teamDetails = await db
      .select({
        teamId: userTeams.teamId,
        teamName: userTeams.teamName,
        userId: userTeams.userId,
        totalPoints: userTeams.totalPoints,
        createdAt: userTeams.createdAt,
      })
      .from(userTeams)
      .where(eq(userTeams.teamId, teamIds));

    // Get user information
    const userIds = enrollments.map(enrollment => enrollment.userId);
    const userDetails = await db
      .select({
        id: users.id,
        handle: users.handle,
      })
      .from(users)
      .where(eq(users.id, userIds));

    // Combine enrollment data with team and user data
    const enrollmentsWithDetails = enrollments.map(enrollment => {
      const team = teamDetails.find(team => team.teamId === enrollment.userTeamId);
      const user = userDetails.find(user => user.id === enrollment.userId);
      
      return {
        ...enrollment,
        team: team || null,
        user: user ? {
          id: user.id,
          handle: user.handle,
        } : null,
      };
    });

    // Sort by rank if match has started, otherwise by enrollment time
    const sortedEnrollments = contest.status !== "CREATED" 
      ? enrollmentsWithDetails.sort((a, b) => (a.rank || 999) - (b.rank || 999))
      : enrollmentsWithDetails.sort((a, b) => new Date(a.enrollmentTime).getTime() - new Date(b.enrollmentTime).getTime());

    return {
      success: true,
      data: {
        contest,
        enrollments: sortedEnrollments,
        enrollmentCount: enrollments.length,
      },
    };
  } catch (error: any) {
    console.error("Error fetching contest enrollments:", error);
    
    return {
      success: false,
      message: "Failed to fetch contest enrollments",
      error: error.message,
    };
  }
});