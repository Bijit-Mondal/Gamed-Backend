import { defineEventHandler } from 'h3';
import { eq, and, sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { db } from '../../../../db';
import { matches, players, playerPerformances, userTeams, userTeamPlayers, contestEnrollments, teams } from '../../../../db/schema';
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

// Match Status parsing
interface MatchStatus {
  statusText: string;
  team1Name: string;
  team1Score: string;
  team2Name: string;
  team2Score: string;
  isCompleted: boolean;
}

// Batter information
interface BatterInfo {
  name: string;
  dismissalText: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

// Bowler information
interface BowlerInfo {
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  noBalls: number;
  wides: number;
  economy: number;
}

// Fielding stats (catches, run-outs, stumpings)
interface FieldingStats {
  [playerName: string]: {
    catches: number;
    runOuts: number;
    stumpings: number;
  };
}

// Function to calculate player fantasy points
function calculatePlayerPoints(
  batData: Partial<BatterInfo> = {},
  bowlData: Partial<BowlerInfo> = {},
  fieldingData: { catches: number; runOuts: number; stumpings: number } = { catches: 0, runOuts: 0, stumpings: 0 },
  isCaptain: boolean = false,
  isViceCaptain: boolean = false
): number {
  let totalPoints = 0;
  
  // Batting Points
  if (batData.runs) {
    totalPoints += batData.runs * POINT_SYSTEM.RUN_POINTS;
    totalPoints += (batData.fours || 0) * POINT_SYSTEM.BOUNDARY_BONUS;
    totalPoints += (batData.sixes || 0) * POINT_SYSTEM.SIX_BONUS;
    
    // Bonus for half-century and century
    if (batData.runs >= 50 && batData.runs < 100) {
      totalPoints += POINT_SYSTEM.HALF_CENTURY_BONUS;
    } else if (batData.runs >= 100) {
      totalPoints += POINT_SYSTEM.CENTURY_BONUS;
    }
  }
  
  // Bowling Points
  if (bowlData.wickets) {
    totalPoints += bowlData.wickets * POINT_SYSTEM.WICKET_POINTS;
    totalPoints += (bowlData.maidens || 0) * POINT_SYSTEM.MAIDEN_OVER_BONUS;
  }
  
  // Fielding Points
  totalPoints += fieldingData.catches * POINT_SYSTEM.CATCH_POINTS;
  totalPoints += fieldingData.runOuts * POINT_SYSTEM.RUNOUT_POINTS;
  totalPoints += fieldingData.stumpings * POINT_SYSTEM.STUMPING_POINTS;
  
  // Base points (no multiplier yet)
  const basePoints = totalPoints;
  
  // Apply multipliers for captain and vice-captain
  if (isCaptain) {
    totalPoints = basePoints * POINT_SYSTEM.CAPTAIN_MULTIPLIER;
  } else if (isViceCaptain) {
    totalPoints = basePoints * POINT_SYSTEM.VICE_CAPTAIN_MULTIPLIER;
  }
  
  return totalPoints;
}

// Parse match status from scorecard
function parseMatchStatus($: cheerio.CheerioAPI): MatchStatus {
  const statusElement = $('.cb-col.cb-scrcrd-status');
  const statusText = statusElement.text().trim();
  
  // Get team names and scores from innings headers
  const team1Header = $('#innings_1 .cb-col.cb-col-100.cb-scrd-hdr-rw').first();
  const team2Header = $('#innings_2 .cb-col.cb-col-100.cb-scrd-hdr-rw').first();
  
  const team1Text = team1Header.text().trim();
  const team2Text = team2Header.text().trim();
  
  const team1Parts = team1Text.split('Innings');
  const team2Parts = team2Text.split('Innings');
  
  const team1Name = team1Parts[0].trim();
  const team1Score = team1Parts.length > 1 ? team1Parts[1].trim() : '';
  
  const team2Name = team2Parts[0].trim();
  const team2Score = team2Parts.length > 1 ? team2Parts[1].trim() : '';
  
  // Check if match is completed based on the status text
  const isCompleted = statusText.includes('won by') || 
                       statusText.includes('Match drawn') || 
                       statusText.includes('Match tied');
  
  return {
    statusText,
    team1Name,
    team1Score,
    team2Name,
    team2Score,
    isCompleted
  };
}

// Parse batting data from a single innings
function parseBattingData($: cheerio.CheerioAPI, inningsId: string): { batters: BatterInfo[], dnbPlayers: string[] } {
  const batters: BatterInfo[] = [];
  const dnbPlayers: string[] = [];
  
  // Get all batsmen rows
  $(`#${inningsId} .cb-col.cb-col-100.cb-scrd-itms`).each((i, element) => {
    const row = $(element);
    const nameCol = row.find('.cb-col.cb-col-25');
    
    // Skip if not a batsman row (extras, total, etc.)
    if (nameCol.find('a').length === 0) return;
    
    const name = nameCol.find('a').text().trim();
    const dismissalText = row.find('.cb-col.cb-col-33 .text-gray').text().trim();
    
    // Parse runs, balls, fours, sixes
    const runs = parseInt(row.find('.cb-col.cb-col-8.text-right.text-bold').text().trim(), 10) || 0;
    const balls = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(0).text().trim(), 10) || 0;
    const fours = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(1).text().trim(), 10) || 0;
    const sixes = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(2).text().trim(), 10) || 0;
    
    // Parse strike rate
    const srText = row.find('.cb-col.cb-col-8.text-right').eq(3).text().trim();
    const strikeRate = parseFloat(srText) || 0;
    
    batters.push({
      name,
      dismissalText,
      runs,
      balls,
      fours,
      sixes,
      strikeRate
    });
  });
  
  // Handle "Yet to Bat" players
  $(`#${inningsId} .cb-col-73.cb-col a`).each((i, element) => {
    const playerName = $(element).text().trim();
    dnbPlayers.push(playerName);
  });
  
  return { batters, dnbPlayers };
}

// Parse bowling data from a single innings
function parseBowlingData($: cheerio.CheerioAPI, inningsId: string): BowlerInfo[] {
  const bowlers: BowlerInfo[] = [];
  
  // Get all bowler rows
  $(`#${inningsId} .cb-col.cb-col-100.cb-scrd-itms`).each((i, element) => {
    const row = $(element);
    
    // Check if this row is in the bowling section
    const nameCol = row.find('.cb-col.cb-col-38');
    
    if (nameCol.find('a').length === 0) return;
    
    const name = nameCol.find('a').text().trim();
    
    // Parse overs, maidens, runs, wickets
    const overs = row.find('.cb-col.cb-col-8.text-right').eq(0).text().trim();
    const maidens = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(1).text().trim(), 10) || 0;
    const runs = parseInt(row.find('.cb-col.cb-col-10.text-right').text().trim(), 10) || 0;
    const wickets = parseInt(row.find('.cb-col.cb-col-8.text-right.text-bold').text().trim(), 10) || 0;
    
    // Parse no balls, wides, economy
    const noBalls = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(3).text().trim(), 10) || 0;
    const wides = parseInt(row.find('.cb-col.cb-col-8.text-right').eq(4).text().trim(), 10) || 0;
    const economy = parseFloat(row.find('.cb-col.cb-col-10.text-right').eq(1).text().trim()) || 0;
    
    bowlers.push({
      name,
      overs,
      maidens,
      runs,
      wickets,
      noBalls,
      wides,
      economy
    });
  });
  
  return bowlers;
}

// Parse fielding contributions by analyzing dismissal texts
function parseFieldingStats($: cheerio.CheerioAPI): FieldingStats {
  const fieldingStats: FieldingStats = {};
  
  // Process both innings
  ['innings_1', 'innings_2'].forEach(inningsId => {
    $(`#${inningsId} .cb-col.cb-col-100.cb-scrd-itms`).each((i, element) => {
      const row = $(element);
      const dismissalText = row.find('.cb-col.cb-col-33 .text-gray').text().trim();
      
      // Skip if no dismissal (not out, etc.)
      if (!dismissalText || dismissalText === 'not out' || dismissalText === 'batting') return;
      
      // Parse fielding contributions
      if (dismissalText.includes('c ') && dismissalText.includes('b ')) {
        // Catch: "c PlayerName b BowlerName"
        const fielderName = dismissalText.split('c ')[1].split(' b ')[0].trim();
        
        if (!fieldingStats[fielderName]) {
          fieldingStats[fielderName] = { catches: 0, runOuts: 0, stumpings: 0 };
        }
        
        fieldingStats[fielderName].catches += 1;
      } else if (dismissalText.includes('st ') && dismissalText.includes('b ')) {
        // Stumping: "st PlayerName b BowlerName"
        const fielderName = dismissalText.split('st ')[1].split(' b ')[0].trim();
        
        if (!fieldingStats[fielderName]) {
          fieldingStats[fielderName] = { catches: 0, runOuts: 0, stumpings: 0 };
        }
        
        fieldingStats[fielderName].stumpings += 1;
      } else if (dismissalText.includes('run out')) {
        // Run out: "run out (PlayerName)"
        const match = dismissalText.match(/run out \(([^)]+)\)/);
        if (match && match[1]) {
          const fielderName = match[1].trim();
          
          if (!fieldingStats[fielderName]) {
            fieldingStats[fielderName] = { catches: 0, runOuts: 0, stumpings: 0 };
          }
          
          fieldingStats[fielderName].runOuts += 1;
        }
      }
    });
  });
  
  return fieldingStats;
}

export default defineEventHandler(async (event) => {
  try {
    console.log("Starting fantasy points update from scorecard cronjob...");
    
    // Find matches that need updating (LIVE or recently COMPLETED)
    const matchesToUpdate = await db
      .select({
        matchId: matches.matchId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        matchDate: matches.matchDate,
      })
      .from(matches)
      .where(
        eq(matches.matchStatus, "LIVE")
      );
    
    if (!matchesToUpdate.length) {
      return {
        success: true,
        message: "No matches to update",
        updatedMatches: 0
      };
    }
    
    let updatedMatchesCount = 0;
    
    // Process each match
    for (const match of matchesToUpdate) {
      try {
        const matchId = match.matchId;
        
        // Get team names to help identify the correct Cricbuzz match
        const homeTeam = await db
          .select({
            teamName: teams.teamName
          })
          .from(teams)
          .where(eq(teams.teamId, match.homeTeamId))
          .limit(1);
          
        const awayTeam = await db
          .select({
            teamName: teams.teamName
          })
          .from(teams)
          .where(eq(teams.teamId, match.awayTeamId))
          .limit(1);
          
        if (!homeTeam.length || !awayTeam.length) {
          console.error(`Could not find team information for match ${matchId}`);
          continue;
        }
        
        const homeTeamName = homeTeam[0].teamName;
        const awayTeamName = awayTeam[0].teamName;
        
        // Hard-coded Cricbuzz ID mapping for known matches
        // In a production system, you'd store these mappings in a database
        const knownMatches = {
          // Example mapping - replace with your actual match IDs and their corresponding Cricbuzz IDs
          'gt-vs-mi-2025': '115014',
          'csk-vs-rcb-2025': '115015',
          // Add more mappings as needed
        };
        
        // Try to get Cricbuzz ID from our mapping
        let cricbuzzMatchId: string;
        
        if (knownMatches[matchId]) {
          cricbuzzMatchId = knownMatches[matchId];
        } else {
          // If no mapping exists, you need a fallback strategy:
          // 1. You could hard-code a few current live matches
          // 2. You could search Cricbuzz programmatically (beyond scope of this example)
          // 3. You could store Cricbuzz IDs in your database (recommended long-term)
          
          // For now, assign a default test ID - this approach is NOT recommended for production!
          // This is just for demonstration - in a real system, you'd need proper mapping
          console.warn(`No Cricbuzz ID mapping found for match ${matchId} (${homeTeamName} vs ${awayTeamName}). Using default ID.`);
          cricbuzzMatchId = '115014'; // Default to GT vs MI match for testing
        }
        
        console.log(`Fetching scorecard for match ${matchId} (${homeTeamName} vs ${awayTeamName}) from Cricbuzz ID ${cricbuzzMatchId}`);
        
        // Fetch the HTML content of the scorecard page
        const response = await fetch(`https://www.cricbuzz.com/api/html/cricket-scorecard/${cricbuzzMatchId}`);
        
        if (!response.ok) {
          console.error(`Failed to fetch scorecard for match ${matchId}: ${response.statusText}`);
          continue;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Parse match status
        const matchStatus = parseMatchStatus($);
        console.log(`Match status: ${matchStatus.statusText}`);
        
        // Check if the match status should be updated
        const shouldUpdateMatchStatus = matchStatus.isCompleted;
        
        // Parse batting data for both innings
        const innings1Batting = parseBattingData($, 'innings_1');
        const innings2Batting = parseBattingData($, 'innings_2');
        
        // Parse bowling data for both innings
        const innings1Bowling = parseBowlingData($, 'innings_1');
        const innings2Bowling = parseBowlingData($, 'innings_2');
        
        // Parse fielding contributions
        const fieldingStats = parseFieldingStats($);
        
        // Combine all player data (batting + bowling + fielding)
        const allPlayers = new Map();
        
        // Add batting data
        [...innings1Batting.batters, ...innings2Batting.batters].forEach(batter => {
          if (!allPlayers.has(batter.name)) {
            allPlayers.set(batter.name, {
              batting: batter,
              bowling: null,
              fielding: { catches: 0, runOuts: 0, stumpings: 0 }
            });
          } else {
            allPlayers.get(batter.name).batting = batter;
          }
        });
        
        // Add bowling data
        [...innings1Bowling, ...innings2Bowling].forEach(bowler => {
          if (!allPlayers.has(bowler.name)) {
            allPlayers.set(bowler.name, {
              batting: null,
              bowling: bowler,
              fielding: { catches: 0, runOuts: 0, stumpings: 0 }
            });
          } else {
            allPlayers.get(bowler.name).bowling = bowler;
          }
        });
        
        // Add fielding data
        Object.entries(fieldingStats).forEach(([name, stats]) => {
          if (!allPlayers.has(name)) {
            allPlayers.set(name, {
              batting: null,
              bowling: null,
              fielding: stats
            });
          } else {
            allPlayers.get(name).fielding = stats;
          }
        });
        
        // Add players who didn't bat
        [...innings1Batting.dnbPlayers, ...innings2Batting.dnbPlayers].forEach(name => {
          if (!allPlayers.has(name)) {
            allPlayers.set(name, {
              batting: null,
              bowling: null,
              fielding: { catches: 0, runOuts: 0, stumpings: 0 }
            });
          }
        });
        
        console.log(`Found ${allPlayers.size} players in the scorecard`);
        
        // Update performance for each player
        for (const [playerName, playerData] of allPlayers.entries()) {
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
            // Try with a more flexible name match (e.g., "R Sharma" matches "Rohit Sharma")
            const nameParts = playerName.split(' ');
            if (nameParts.length >= 2) {
              const lastName = nameParts[nameParts.length - 1];
              
              const potentialPlayers = await db
                .select({
                  playerId: players.playerId,
                  fullName: players.fullName
                })
                .from(players)
                .where(sql`${players.fullName} LIKE ${'%' + lastName}`)
                .limit(5);
              
              if (potentialPlayers.length === 0) {
                console.log(`Player "${playerName}" not found in database. Skipping performance update.`);
                continue;
              }
              
              // Use the first match (in a real implementation, you'd need a more robust mapping)
              console.log(`Using fuzzy match: ${playerName} -> ${potentialPlayers[0].fullName}`);
              var playerId = potentialPlayers[0].playerId;
            } else {
              console.log(`Player "${playerName}" not found in database. Skipping performance update.`);
              continue;
            }
          } else {
            var playerId = playerInDb[0].playerId;
          }
          
          console.log(`Updating performance for player ${playerName} (ID: ${playerId})`);
          
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
          
          // Extract data for the player
          const batting = playerData.batting || { runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
          const bowling = playerData.bowling || { overs: "0", maidens: 0, runs: 0, wickets: 0, economy: 0 };
          const fielding = playerData.fielding || { catches: 0, runOuts: 0, stumpings: 0 };
          
          // Calculate fantasy points
          const points = calculatePlayerPoints(batting, bowling, fielding);
          
          // Update or insert player performance
          if (existingPerformance.length > 0) {
            await db
              .update(playerPerformances)
              .set({
                runsScored: batting.runs || 0,
                ballsFaced: batting.balls || 0,
                wicketsTaken: bowling.wickets || 0,
                oversBowled: bowling.overs || "0",
                catches: fielding.catches || 0,
                stumpings: fielding.stumpings || 0,
                runOuts: fielding.runOuts || 0,
                strikeRate: (batting.strikeRate || 0).toString(),
                economyRate: (bowling.economy || 0).toString(),
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
                runsScored: batting.runs || 0,
                ballsFaced: batting.balls || 0,
                wicketsTaken: bowling.wickets || 0,
                oversBowled: bowling.overs || "0",
                catches: fielding.catches || 0,
                stumpings: fielding.stumpings || 0,
                runOuts: fielding.runOuts || 0,
                strikeRate: (batting.strikeRate || 0).toString(),
                economyRate: (bowling.economy || 0).toString(),
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
        
        // Update match status if completed
        if (shouldUpdateMatchStatus) {
          await db
            .update(matches)
            .set({
              matchStatus: "COMPLETED"
            })
            .where(eq(matches.matchId, matchId));
        }
        
        updatedMatchesCount++;
      } catch (error: any) {
        console.error(`Error processing match ${match.matchId}:`, error);
        continue;
      }
    }
    
    return {
      success: true,
      message: "Fantasy points updated successfully from scorecard data",
      updatedMatches: updatedMatchesCount
    };
  } catch (error: any) {
    console.error("Error in fantasy points update from scorecard cronjob:", error);
    
    return {
      success: false,
      message: "Failed to update fantasy points from scorecard",
      error: error.message,
    };
  }
});