import { defineEventHandler } from "h3";
import { db } from "../../../db";
import { teams } from "../../../db/schema";

export default defineEventHandler(async () => {
  try {
    const allTeams = await db.select().from(teams);
    
    return {
      success: true,
      data: allTeams
    };
  } catch (error: any) {
    console.error("Error fetching teams:", error);
    
    return {
      success: false,
      message: "Failed to fetch teams",
      error: error.message
    };
  }
});