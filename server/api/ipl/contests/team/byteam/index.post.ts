import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { defineEventHandler, readBody } from "h3";
import { db } from "../../../../../db";
import { contests, contestEnrollments, matches, userTeams } from "../../../../../db/schema";
import { z } from "zod";

// Validation schema for team enrollment in a contest
const enrollTeamSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  contestId: z.string().min(1, "Contest ID is required"),
});

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);

    // Validate request body
    const validationResult = enrollTeamSchema.safeParse(body);

    if (!validationResult.success) {
      return {
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      };
    }

    const enrollmentData = validationResult.data;

    // Check if team exists and belongs to the user
    const teamExists = await db
      .select({
        teamId: userTeams.teamId,
        matchId: userTeams.matchId,
        userId: userTeams.userId,
      })
      .from(userTeams)
      .where(
        and(
          eq(userTeams.teamId, enrollmentData.teamId),
          eq(userTeams.userId, enrollmentData.userId)
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

    // Check if contest exists
    const contestExists = await db
      .select({
        contestId: contests.contestId,
        matchId: contests.matchId,
        totalSpots: contests.totalSpots,
        filledSpots: contests.filledSpots,
        status: contests.status,
      })
      .from(contests)
      .where(eq(contests.contestId, enrollmentData.contestId))
      .limit(1);

    if (!contestExists.length) {
      return {
        success: false,
        message: "Contest not found",
      };
    }

    const contest = contestExists[0];

    // Check if contest is for the same match as the team
    if (contest.matchId !== team.matchId) {
      return {
        success: false,
        message: "Contest is not for the same match as the team",
      };
    }

    // Check if contest is still open
    if (contest.status !== "CREATED") {
      return {
        success: false,
        message: "Contest is no longer accepting entries",
      };
    }

    // Check if contest is full
    if (contest.filledSpots >= contest.totalSpots) {
      return {
        success: false,
        message: "Contest is full",
      };
    }

    // Check if team is already enrolled in this contest
    const existingEnrollment = await db
      .select({ enrollmentId: contestEnrollments.enrollmentId })
      .from(contestEnrollments)
      .where(
        and(
          eq(contestEnrollments.contestId, enrollmentData.contestId),
          eq(contestEnrollments.userTeamId, enrollmentData.teamId)
        )
      )
      .limit(1);

    if (existingEnrollment.length) {
      return {
        success: false,
        message: "Team is already enrolled in this contest",
      };
    }

    // Check if match is still upcoming
    const matchStatus = await db
      .select({ status: matches.matchStatus })
      .from(matches)
      .where(eq(matches.matchId, team.matchId))
      .limit(1);

    if (!matchStatus.length || matchStatus[0].status !== "UPCOMING") {
      return {
        success: false,
        message: "Match has already started or is not available",
      };
    }

    // Enroll the team in the contest
    const enrollmentId = uuidv4();
    await db.insert(contestEnrollments).values({
      enrollmentId,
      contestId: enrollmentData.contestId,
      userTeamId: enrollmentData.teamId,
      userId: enrollmentData.userId,
      enrollmentTime: new Date().toISOString(),
      status: "ACTIVE",
    });

    // Update the filledSpots counter in the contest
    const currentFilledSpots = contest.filledSpots || 0;
    
    await db
      .update(contests)
      .set({
        filledSpots: currentFilledSpots + 1,
      })
      .where(eq(contests.contestId, enrollmentData.contestId));

    return {
      success: true,
      message: "Team successfully enrolled in contest",
      data: {
        enrollmentId,
        teamId: enrollmentData.teamId,
        contestId: enrollmentData.contestId,
      },
    };
  } catch (error: any) {
    console.error("Error enrolling team in contest:", error);

    return {
      success: false,
      message: "Failed to enroll team in contest",
      error: error.message,
    };
  }
});