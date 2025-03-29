import { defineEventHandler, readBody } from "h3";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../../db";
import { contests, matches } from "../../../db/schema";
import { z } from "zod";

// Validation schema for contest creation
const createContestSchema = z.object({
  matchId: z.string().min(1, "Match ID is required"),
  contestName: z.string().min(3, "Contest name must be at least 3 characters"),
  totalSpots: z.number().int().positive("Total spots must be a positive number"),
  entryFee: z.string().min(1, "Entry fee is required"),
  totalPrizePool: z.string().min(1, "Total prize pool is required"),
  contestType: z.enum(["MEGA", "HEAD_TO_HEAD", "PRACTICE", "PREMIUM"], {
    errorMap: () => ({ message: "Invalid contest type" }),
  }),
  startTime: z.string().min(1, "Start time is required"),
});

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const body = await readBody(event);
    
    // Validate request body
    const validationResult = createContestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors,
      };
    }
    
    const contestData = validationResult.data;
    
    // Check if match exists
    const matchExists = await db
      .select({ matchId: matches.matchId })
      .from(matches)
      .where(eq(matches.matchId, contestData.matchId))
      .limit(1);
    
    if (!matchExists.length) {
      return {
        success: false,
        message: "Match not found",
      };
    }
    
    // Generate a unique contest ID
    const contestId = uuidv4();
    
    // Create the contest using camelCase property names
    const newContest = await db.insert(contests).values({
      contestId,
      matchId: contestData.matchId,
      contestName: contestData.contestName,
      totalSpots: contestData.totalSpots,
      filledSpots: 0,
      entryFee: contestData.entryFee,
      totalPrizePool: contestData.totalPrizePool,
      contestType: contestData.contestType,
      startTime: contestData.startTime,
      status: "CREATED",
    }).returning();
    
    return {
      success: true,
      message: "Contest created successfully",
      data: newContest[0],
    };
    
  } catch (error: any) {
    console.error("Error creating contest:", error);
    
    return {
      success: false,
      message: "Failed to create contest",
      error: error.message,
    };
  }
});