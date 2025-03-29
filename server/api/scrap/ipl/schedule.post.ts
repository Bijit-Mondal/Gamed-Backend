import { defineEventHandler } from "h3";
import * as cheerio from "cheerio";
import { db } from "../../../db";
import { matches, teams } from "../../../db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  try {
    // Schedule page URL for IPL 2025
    const scheduleUrl = "https://www.cricbuzz.com/cricket-series/9237/indian-premier-league-2025/matches";
    
    // Fetch the HTML content
    const response = await fetch(scheduleUrl);
    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);

    // Get all teams from the database for reference
    const allTeams = await db.select().from(teams);
    
    // Team name mapping (Cricbuzz name to our DB name)
    // This helps with handling different team name formats
    const teamNameMapping: Record<string, string> = {
      "Royal Challengers Bengaluru": "Royal Challengers Bengaluru",
      "Mumbai Indians": "Mumbai Indians",
      "Chennai Super Kings": "Chennai Super Kings",
      "Kolkata Knight Riders": "Kolkata Knight Riders",
      "Sunrisers Hyderabad": "Sunrisers Hyderabad",
      "Delhi Capitals": "Delhi Capitals",
      "Punjab Kings": "Punjab Kings",
      "Rajasthan Royals": "Rajasthan Royals",
      "Lucknow Super Giants": "Lucknow Super Giants",
      "Gujarat Titans": "Gujarat Titans",
      // Add any other variations as needed
    };

    // Results tracking
    const results = {
      success: true,
      totalMatches: 0,
      matchesAdded: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      details: [] as {
        matchId: string;
        teams: string;
        date: string;
        status: string;
        action: "added" | "updated" | "skipped";
      }[],
    };

    // Function to find team ID by name
    const findTeamId = (teamName: string): string | undefined => {
      // Check if there's a name mapping
      const normalizedName = teamNameMapping[teamName] || teamName;
      
      // Find the team in our database
      const team = allTeams.find((t) => 
        t.teamName.toLowerCase() === normalizedName.toLowerCase()
      );
      
      return team?.teamId;
    };

    // Process each match entry one by one using a for-of loop instead of .each()
    const matchElements = $('.cb-series-matches').toArray();
    
    for (const element of matchElements) {
      try {
        // Extract match details and URL
        const matchElement = $(element);
        const matchLinkElement = matchElement.find('a[title*="vs"]').first();
        const matchUrl = matchLinkElement.attr('href');
        
        // Skip if no match URL found
        if (!matchUrl) continue;
        
        // Extract match ID from URL pattern: /live-cricket-scores/115014/gt-vs-mi-9th-match-indian-premier-league-2025
        let matchIdMatch = matchUrl.match(/\/live-cricket-scores\/(\d+)\//);
        let matchId = matchIdMatch ? matchIdMatch[1] : null;
        
        if (!matchId) {
          console.log(`Could not extract match ID from URL: ${matchUrl}`);
          matchIdMatch = matchUrl.match(/\/cricket-scores\/(\d+)\//);
          matchId = matchIdMatch ? matchIdMatch[1] : null;
          continue;
        }
        
        // Extract match title (includes team names)
        const matchTitle = matchLinkElement.text().trim();
        const teamVsMatch = matchTitle.match(/(.+) vs (.+),/);
        
        if (!teamVsMatch || teamVsMatch.length < 3) {
          console.log(`Could not extract team names from title: ${matchTitle}`);
          continue;
        }
        
        const homeTeamName = teamVsMatch[1].trim();
        const awayTeamName = teamVsMatch[2].trim();
        
        // Find team IDs
        const homeTeamId = findTeamId(homeTeamName);
        const awayTeamId = findTeamId(awayTeamName);
        
        if (!homeTeamId || !awayTeamId) {
          console.log(`Could not find team IDs for ${homeTeamName} vs ${awayTeamName}`);
          results.matchesSkipped++;
          continue;
        }
        
        // Extract venue
        const venueElement = matchElement.find('.text-gray').first();
        const venue = venueElement.text().trim();
        
        // Extract match date
        const dateElement = matchElement.find('.schedule-date').first();
        let matchDate = dateElement.attr('timestamp') 
          ? new Date(parseInt(dateElement.attr('timestamp') || '0')).toISOString()
          : new Date().toISOString();
        
        // Determine match status - Improved status detection logic
        let matchStatus: "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELED" = "UPCOMING";
        
        // Find status elements
        const statusCompleteElement = matchElement.find('.cb-text-complete');
        const statusInProgressElement = matchElement.find('.cb-text-inprogress');
        const statusPreviewElement = matchElement.find('.cb-text-preview');
        const statusUpcomingElement = matchElement.find('.cb-text-upcoming');
        
        // Get status texts
        const completeText = statusCompleteElement.length ? statusCompleteElement.text().toLowerCase() : '';
        const inProgressText = statusInProgressElement.length ? statusInProgressElement.text().toLowerCase() : '';
        const combinedStatusText = `${completeText} ${inProgressText}`.toLowerCase();
        
        // Log status texts for debugging
        console.log(`Match ${matchId} status texts:`, { 
          complete: completeText,
          inProgress: inProgressText,
          hasCompleteElement: statusCompleteElement.length > 0,
          hasInProgressElement: statusInProgressElement.length > 0
        });
        
        // Determine status based on text and elements present
        if (combinedStatusText.includes('won') || completeText.includes('won')) {
          matchStatus = "COMPLETED";
        } else if (inProgressText.includes('live') || combinedStatusText.includes('live') || 
                  inProgressText.includes('opt to') || combinedStatusText.includes('opt to') ||
                  statusInProgressElement.length > 0) {
          matchStatus = "LIVE";
        } else if (combinedStatusText.includes('cancel')) {
          matchStatus = "CANCELED";
        } else if (statusPreviewElement.length > 0 || statusUpcomingElement.length > 0) {
          matchStatus = "UPCOMING";
        }
        
        // Check if there's a winning team (if the match is completed)
        let winningTeamId: string | null = null;
        
        if (matchStatus === "COMPLETED") {
          const resultText = statusCompleteElement.text();
          
          // Check which team won
          if (resultText.includes(homeTeamName) || resultText.toLowerCase().includes(homeTeamName.toLowerCase())) {
            winningTeamId = homeTeamId;
          } else if (resultText.includes(awayTeamName) || resultText.toLowerCase().includes(awayTeamName.toLowerCase())) {
            winningTeamId = awayTeamId;
          }
        }
        
        // Prepare match data
        const matchData = {
          matchId,
          homeTeamId,
          awayTeamId,
          matchDate,
          matchType: "IPL" as const,
          venue,
          matchStatus,
          winningTeamId: winningTeamId || null,
          tossWinnerTeamId: null, // Can't determine from schedule page
        };
        
        // Check if match already exists
        const existingMatch = await db.select().from(matches).where(eq(matches.matchId, matchId));
        
        if (existingMatch.length > 0) {
          // Update existing match
          await db.update(matches)
            .set(matchData)
            .where(eq(matches.matchId, matchId));
          
          results.matchesUpdated++;
          results.details.push({
            matchId,
            teams: `${homeTeamName} vs ${awayTeamName}`,
            date: matchDate,
            status: matchStatus,
            action: "updated"
          });
        } else {
          // Insert new match
          await db.insert(matches).values(matchData);
          
          results.matchesAdded++;
          results.details.push({
            matchId,
            teams: `${homeTeamName} vs ${awayTeamName}`,
            date: matchDate,
            status: matchStatus,
            action: "added"
          });
        }
        
        results.totalMatches++;
      } catch (error) {
        console.error("Error processing match:", error);
      }
    }
    
    return results;
    
  } catch (error: any) {
    console.error("Error scraping IPL schedule:", error);
    
    return {
      success: false,
      message: "Failed to scrape IPL schedule",
      error: error.message
    };
  }
});
