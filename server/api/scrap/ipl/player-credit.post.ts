import { defineEventHandler } from "h3";
import { db } from "../../../db";
import { players } from "../../../db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  try {
    // Get all players from the database
    const allPlayers = await db.select().from(players);
    
    if (allPlayers.length === 0) {
      return {
        success: false,
        message: "No players found in the database.",
      };
    }

    const results = {
      success: true,
      totalPlayersProcessed: 0,
      totalPlayersUpdated: 0,
      failures: [] as { playerId: string; error: string }[],
    };

    // Process each player
    for (const player of allPlayers) {
      try {
        // Skip if player doesn't have a valid ID
        if (!player.playerId) {
          console.error('Player is missing an ID:', player);
          results.failures.push({ 
            playerId: player.playerId || 'unknown',
            error: 'Missing player ID'
          });
          continue;
        }

        // Fetch credit points from external API
        const response = await fetch(`http://localhost:5000/player/${player.playerId}`);
        
        // If the request was not successful, use default value and log error
        if (!response.ok) {
          console.warn(`Failed to fetch credit points for player ${player.playerId}: Status ${response.status}`);
          
          // Update player with default credit value (3)
          await db.update(players)
            .set({ baseCreditValue: 3 })
            .where(eq(players.playerId, player.playerId));
          
          results.totalPlayersProcessed++;
          results.totalPlayersUpdated++;
          continue;
        }

        // Parse response data
        const data = await response.json();
        
        // Check if data is in expected format
        if (!Array.isArray(data) || data.length === 0 || !data[0].credit_points) {
          console.warn(`Invalid response format for player ${player.playerId}`);
          results.failures.push({
            playerId: player.playerId,
            error: 'Invalid response format from API'
          });
          continue;
        }

        const creditPoints = data[0].credit_points;
        
        // Update player with the received credit value
        await db.update(players)
          .set({ baseCreditValue: creditPoints })
          .where(eq(players.playerId, player.playerId));
        
        results.totalPlayersProcessed++;
        results.totalPlayersUpdated++;
        
      } catch (error: any) {
        console.error(`Error updating credit for player ${player.playerId}:`, error);
        results.failures.push({
          playerId: player.playerId,
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error: any) {
    console.error("Error updating player credits:", error);
    
    return {
      success: false,
      message: "Failed to update player credits",
      error: error.message
    };
  }
});