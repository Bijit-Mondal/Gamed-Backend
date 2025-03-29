import { defineEventHandler } from 'h3';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../../db';
import { matches, players, playerPerformances, userTeams, userTeamPlayers, contestEnrollments } from '../../../../db/schema';
import { nanoid } from 'nanoid';

// Constants for fantasy points calculation
const POINT_SYSTEM = {
  // Batting Points
  RUN_POINTS: 1,  // 1 point per run
  BOUNDARY_BONUS: 1,  // 1 extra point for boundaries
  SIX_BONUS: 2,  // 2 extra points for sixes
  HALF_CENTURY_BONUS: 25,  // 25 points for 50 runs
  CENTURY_BONUS: 50,  // 50 points for 100 runs
  
  // Bowling Points
  WICKET_POINTS: 25,  // 25 points per wicket
  MAIDEN_OVER_BONUS: 12,  // 12 points for maiden over
  
  // Fielding Points
  CATCH_POINTS: 8,  // 8 points per catch
  RUNOUT_POINTS: 10,  // 10 points per run-out
  STUMPING_POINTS: 12,  // 12 points per stumping
  
  // Performance Multipliers
  CAPTAIN_MULTIPLIER: 2,  // Captain gets 2x points
  VICE_CAPTAIN_MULTIPLIER: 1.5  // Vice-captain gets 1.5x points
};

// Interface for Cricbuzz API response
interface CricbuzzResponse {
  commentaryList: any[];
  matchHeader: {
    matchId: number;
    state: string;
  };
  miniscore: {
    batsmanStriker: BatsmanInfo;
    batsmanNonStriker: BatsmanInfo;
    bowlerStriker: BowlerInfo;
    bowlerNonStriker: BowlerInfo;
    matchScoreDetails: {
      matchId: number;
    };
  };
}

interface BatsmanInfo {
  batId: number;
  batName: string;
  batRuns: number;
  batBalls: number;
  batFours: number;
  batSixes: number;
  batStrikeRate: number;
}

interface BowlerInfo {
  bowlId: number;
  bowlName: string;
  bowlOvs: number;
  bowlRuns: number;
  bowlWkts: number;
  bowlMaidens: number;
}

// Function to calculate player fantasy points
function calculatePlayerPoints(
  playerData: any,
  isCaptain: boolean = false,
  isViceCaptain: boolean = false
): number {
  let totalPoints = 0;
  
  // Batting Points
  if (playerData.batRuns) {
    totalPoints += playerData.batRuns * POINT_SYSTEM.RUN_POINTS;
    totalPoints += playerData.batFours * POINT_SYSTEM.BOUNDARY_BONUS;
    totalPoints += playerData.batSixes * POINT_SYSTEM.SIX_BONUS;
    
    // Bonus for half-century and century
    if (playerData.batRuns >= 50 && playerData.batRuns < 100) {
      totalPoints += POINT_SYSTEM.HALF_CENTURY_BONUS;
    } else if (playerData.batRuns >= 100) {
      totalPoints += POINT_SYSTEM.CENTURY_BONUS;
    }
  }
  
  // Bowling Points
  if (playerData.bowlWkts) {
    totalPoints += playerData.bowlWkts * POINT_SYSTEM.WICKET_POINTS;
    totalPoints += playerData.bowlMaidens * POINT_SYSTEM.MAIDEN_OVER_BONUS;
  }
  
  // Apply multipliers for captain and vice-captain
  if (isCaptain) {
    totalPoints *= POINT_SYSTEM.CAPTAIN_MULTIPLIER;
  } else if (isViceCaptain) {
    totalPoints *= POINT_SYSTEM.VICE_CAPTAIN_MULTIPLIER;
  }
  
  return totalPoints;
}

export default defineEventHandler(async (event) => {
  try {
    console.log("Starting fantasy points update cronjob...");
    
    // Find all live matches
    const liveMatches = await db
      .select({
        matchId: matches.matchId,
      })
      .from(matches)
      .where(eq(matches.matchStatus, "LIVE"));
    
    if (!liveMatches.length) {
      return {
        success: true,
        message: "No live matches to update",
        updatedMatches: 0
      };
    }
    
    let updatedMatchesCount = 0;
    
    // Process each live match
    for (const match of liveMatches) {
      try {
        // Fetch data from Cricbuzz API
        const matchId = match.matchId;
        // In a real scenario, you'd need to map your match ID to Cricbuzz match ID
        // This is a placeholder - you'll need to store and retrieve the actual Cricbuzz ID
        const cricbuzzMatchId = match.matchId; // Replace with actual mapping logic
        
        const response = await fetch(`https://www.cricbuzz.com/api/cricket-match/commentary/${cricbuzzMatchId}`);
        
        if (!response.ok) {
          console.error(`Failed to fetch data for match ${matchId}: ${response.statusText}`);
          continue;
        }
        
        const data: CricbuzzResponse = await response.json();
    

        // Check if match is still live
        if (data.matchHeader.state !== "In Progress") {
          continue;
        }
        
        // Get player info from the miniscore
        const playersData = [
          data.miniscore.batsmanStriker,
          data.miniscore.batsmanNonStriker,
          data.miniscore.bowlerStriker,
          data.miniscore.bowlerNonStriker
        ].filter(p => p && (p.batId !== 0 || p.bowlId !== 0));
        
        // Update performance for each player
        // Update performance for each player
for (const playerData of playersData) {
    // Get player name from the data
    const playerName = playerData.batName || playerData.bowlName;
    
    if (!playerName) {
      console.log("Player name not found in API data, skipping...");
      continue;
    }
    
    console.log(`Looking for player with name: ${playerName}`);
    
    // Find player in our database by name
    const playerInDb = await db
      .select({
        playerId: players.playerId,
        fullName: players.fullName
      })
      .from(players)
      .where(eq(players.fullName, playerName))
      .limit(1);
    
    if (playerInDb.length === 0) {
      console.log(`Player "${playerName}" not found in database. Skipping performance update.`);
      continue;
    }
    
    const playerId = playerInDb[0].playerId;
    console.log(`Found player ${playerName} with ID ${playerId}`);
    
    // Check if performance record exists
    const existingPerformance = await db
      .select({ performanceId: playerPerformances.performanceId })
      .from(playerPerformances)
      .where(
        and(
          eq(playerPerformances.matchId, matchId),
          eq(playerPerformances.playerId, playerId)
        )
      );
    
    const performanceId = existingPerformance.length > 0 
      ? existingPerformance[0].performanceId 
      : nanoid();
    
    // Calculate fantasy points
    const points = calculatePlayerPoints(playerData);
    
    // Update or insert player performance
    if (existingPerformance.length > 0) {
      await db
        .update(playerPerformances)
        .set({
          runsScored: playerData.batRuns || 0,
          ballsFaced: playerData.batBalls || 0,
          wicketsTaken: playerData.bowlWkts || 0,
          oversBowled: playerData.bowlOvs?.toString() || "0",
          catches: 0, // Not available in miniscore data
          stumpings: 0, // Not available in miniscore data
          runOuts: 0, // Not available in miniscore data
          strikeRate: playerData.batStrikeRate?.toString() || "0",
          economyRate: playerData.bowlEcon?.toString() || "0",
          totalFantasyPoints: points.toString(),
        })
        .where(eq(playerPerformances.performanceId, performanceId));
    } else {
      await db
        .insert(playerPerformances)
        .values({
          performanceId,
          matchId,
          playerId,
          runsScored: playerData.batRuns || 0,
          ballsFaced: playerData.batBalls || 0,
          wicketsTaken: playerData.bowlWkts || 0,
          oversBowled: playerData.bowlOvs?.toString() || "0",
          catches: 0, // Not available in miniscore data
          stumpings: 0, // Not available in miniscore data
          runOuts: 0, // Not available in miniscore data
          strikeRate: playerData.batStrikeRate?.toString() || "0",
          economyRate: playerData.bowlEcon?.toString() || "0",
          totalFantasyPoints: points.toString(),
        });
    }
  }
        
        // Update user teams total points
        const userTeamsInMatch = await db
          .select({
            teamId: userTeams.teamId,
          })
          .from(userTeams)
          .where(eq(userTeams.matchId, matchId));
        
        // Update points for each user team
        for (const userTeam of userTeamsInMatch) {
          // Get team players
          const teamPlayers = await db
            .select({
              playerId: userTeamPlayers.playerId,
              isCaptain: userTeamPlayers.isCaptain,
              isViceCaptain: userTeamPlayers.isViceCaptain,
            })
            .from(userTeamPlayers)
            .where(eq(userTeamPlayers.userTeamId, userTeam.teamId));
          
          // Calculate total points for the team
          let totalTeamPoints = 0;
          
          for (const teamPlayer of teamPlayers) {
            // Get player performance
            const performance = await db
              .select({
                totalFantasyPoints: playerPerformances.totalFantasyPoints,
              })
              .from(playerPerformances)
              .where(
                and(
                  eq(playerPerformances.matchId, matchId),
                  eq(playerPerformances.playerId, teamPlayer.playerId)
                )
              );
            
            if (performance.length > 0) {
              let points = parseFloat(performance[0].totalFantasyPoints);
              
              // Apply captain/vice-captain multipliers
              if (teamPlayer.isCaptain) {
                points *= POINT_SYSTEM.CAPTAIN_MULTIPLIER;
              } else if (teamPlayer.isViceCaptain) {
                points *= POINT_SYSTEM.VICE_CAPTAIN_MULTIPLIER;
              }
              
              totalTeamPoints += points;
            }
          }
          
          // Update user team total points
          await db
            .update(userTeams)
            .set({
              totalPoints: totalTeamPoints.toString(),
            })
            .where(eq(userTeams.teamId, userTeam.teamId));
        }
        
        updatedMatchesCount++;
      } catch (error: any) {
        console.error(`Error processing match ${match.matchId}:`, error);
        continue;
      }
    }
    
    return {
      success: true,
      message: "Fantasy points updated successfully",
      updatedMatches: updatedMatchesCount
    };
  } catch (error: any) {
    console.error("Error in fantasy points update cronjob:", error);
    
    return {
      success: false,
      message: "Failed to update fantasy points",
      error: error.message,
    };
  }
});