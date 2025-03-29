import { defineEventHandler } from "h3";
import * as cheerio from "cheerio";
import { db } from "../../../db";
import { players, teams, squad } from "../../../db/schema";
import { eq, sql } from "drizzle-orm";
import { TInsertPlayer, TSelectPlayer, TSelectSquad, TSelectTeam } from "../../../db/types";

export default defineEventHandler(async (event) => {
  try {
    // Get all teams from the database to scrape players for each team
    const allTeams = await db.select().from(teams);
    
    if (allTeams.length === 0) {
      return {
        success: false,
        message: "No teams found in the database. Please scrape teams first.",
      };
    }

    const results = {
      success: true,
      totalTeamsProcessed: 0,
      totalPlayersAdded: 0,
      totalPlayersUpdated: 0,
      teamResults: [] as { team: string, playersAdded: number, playersUpdated: number }[],
    };

    // Process each team
    for (const team of allTeams) {
      // Ensure team has a valid name
      if (!team.teamName || typeof team.teamName !== 'string') {
        console.error('Team is missing a name or name is not a string:', team);
        continue;
      }
      
      // Ensure team has a valid ID
      if (!team.teamId || typeof team.teamId !== 'string') {
        console.error('Team is missing an ID or ID is not a string:', team);
        continue;
      }

      // Build the team's squad page URL
      let teamSlug = team.teamName.toLowerCase().replace(/ /g, "-");
      
      // Special Case for Ae Sala Cup Namde
      if (teamSlug === "royal-challengers-bengaluru") {
        teamSlug = "royal-challengers-bangalore";
      }

      const teamUrl = `https://www.iplt20.com/teams/${teamSlug}/squad`;
      
      console.log(`Scraping players for ${team.teamName} from ${teamUrl}`);
      
      try {
        // Fetch the HTML content of the team's squad page
        const response = await fetch(teamUrl);
        
        // Load the HTML content into cheerio
        const htmlText = await response.text();
        const $ = cheerio.load(htmlText);
        
        // Array to store player data
        const playersData: TInsertPlayer[] = [];
        
        // Track stats for this team
        let teamPlayersAdded = 0;
        let teamPlayersUpdated = 0;

        // Extract player information from each player card
        $(".ih-pcard1").each((index, element) => {
          const playerElement = $(element);
          
          // Extract player name
          const playerName = playerElement.find(".ih-p-name h2").text().trim();
          
          // Skip if no player name found
          if (!playerName) return;
          
          // Extract player role/type text
          const playerRoleText = playerElement.find(".ih-p-img > span").text().trim();
          
          // Determine player type based on the role text
          let playerType: "BATSMAN" | "BOWLER" | "ALL_ROUNDER" | "WICKET_KEEPER" = "BATSMAN";
          
          if (playerRoleText.includes("All-Rounder") || playerRoleText.includes("All Rounder")) {
            playerType = "ALL_ROUNDER";
          } else if (playerRoleText.includes("Bowler")) {
            playerType = "BOWLER";
          } else if (playerRoleText.includes("WK-Batter") || 
                     playerRoleText.includes("Wicketkeeper Batter") || 
                     playerRoleText.includes("Wicket-keeper")) {
            playerType = "WICKET_KEEPER";
          } else if (playerRoleText.includes("Batter")) {
            playerType = "BATSMAN";
          }
          
          // Check if player is foreign (non-Indian)
          const isForeign = playerElement.find(".teams-icon span img[alt*='foreign']").length > 0;
          
          // Generate a unique ID for the player (based on name, convert to kebab-case)
          const playerId = playerName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/-$/, "");
          
          // Create a valid player object with required fields
          const playerData: TInsertPlayer = {
            playerId,
            fullName: playerName,
            country: isForeign ? "International" : "India",
            playerType,
            baseCreditValue: 8 // Default credit value
          };
          
          // Add player to the array if valid
          playersData.push(playerData);
        });
        
        console.log(`Found ${playersData.length} players for team ${team.teamName}`);
        
        // Process each player - upsert to database and link to team
        for (const playerData of playersData) {
          // Check if player already exists
          const existingPlayer = await db.select().from(players).where(eq(players.playerId, playerData.playerId));
          
          if (existingPlayer.length > 0) {
            // Update existing player
            await db.update(players)
              .set(playerData)
              .where(eq(players.playerId, playerData.playerId));
            
            teamPlayersUpdated++;
          } else {
            // Insert new player
            await db.insert(players).values(playerData);
            teamPlayersAdded++;
          }
          
          // Check if player is already in the squad
          const existingSquadEntry = await db
            .select()
            .from(squad)
            .where(
              sql`${squad.playerId} = ${playerData.playerId} AND ${squad.teamId} = ${team.teamId}`
            );
          
          // If not in squad, add to squad
          if (existingSquadEntry.length === 0) {
            const squadData = {
              playerId: playerData.playerId,
              teamId: team.teamId,
              isActive: true,
              joinedDate: new Date().toISOString()
            };
            
            await db.insert(squad).values(squadData);
          }
        }
        
        results.totalPlayersAdded += teamPlayersAdded;
        results.totalPlayersUpdated += teamPlayersUpdated;
        results.totalTeamsProcessed++;
        results.teamResults.push({
          team: team.teamName,
          playersAdded: teamPlayersAdded,
          playersUpdated: teamPlayersUpdated
        });
        
      } catch (error) {
        console.error(`Error scraping players for team ${team.teamName}:`, error);
        // Continue with next team even if this one fails
      }
    }
    
    return results;
    
  } catch (error: any) {
    console.error("Error scraping IPL players:", error);
    
    return {
      success: false,
      message: "Failed to scrape IPL players",
      error: error.message
    };
  }
});