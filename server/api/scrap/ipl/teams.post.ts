import { defineEventHandler } from "h3";
import * as cheerio from "cheerio";
import { db } from "../../../db";
import { teams } from "../../../db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  try {
    // Load the HTML content into cheerio
    const response = await fetch("https://www.iplt20.com/teams");
    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);
    
    // Array to store the team data
    const teamsData = [];
    
    // Extract team information from the teams list
    $(".vn-teamsInnerWrp li").each((index, element) => {
      const teamElement = $(element);
      
      // Extract team name
      const teamName = teamElement.find(".ap-team-contn h3").text().trim();
      
      // Extract team abbreviation (appears in span inside vn-team-logo-onhover)
      const teamAbbr = teamElement.find(".vn-team-logo-onhover span").text().trim();
      
      // Extract logo URL
      const logoUrl = teamElement.find(".vn-team-logo img").attr("src") || "";
      
      // Extract trophies if any (appears inside trophy-text-align div)
      const trophiesText = teamElement.find(".trophy-text-align").text().trim();
      
      // Get the team type class (e.g., TL_CSK, TL_MI)
      const teamTypeClass = teamElement.attr("class")?.trim() || "";
      
      // Generate a unique team ID using abbreviation (lowercase) and current year
      const teamId = `${teamAbbr.toLowerCase()}_2025`;
      
      // Add team to the array
      teamsData.push({
        teamId,
        teamName,
        country: "India", // All IPL teams are from India
        logoUrl,
        teamType: "IPL",
        abbreviation: teamAbbr,
        trophies: trophiesText || null,
        cssClass: teamTypeClass || null
      });
    });
    
    // Check if teams were found
    if (teamsData.length === 0) {
      return {
        success: false,
        message: "No teams found on the page",
      };
    }
    
    // Process each team - upsert to database (insert if not exists, update if exists)
    for (const teamData of teamsData) {
      const { abbreviation, trophies, cssClass, ...teamDbData } = teamData;
      
      // Check if team already exists
      const existingTeam = await db.select().from(teams).where(eq(teams.teamId, teamData.teamId));
      
      if (existingTeam.length > 0) {
        // Update existing team
        await db.update(teams)
          .set(teamDbData)
          .where(eq(teams.teamId, teamData.teamId));
      } else {
        // Insert new team
        await db.insert(teams).values(teamDbData);
      }
    }
    
    return {
      success: true,
      message: `Successfully scraped and updated ${teamsData.length} IPL teams`,
      teams: teamsData
    };
    
  } catch (error: any) {
    console.error("Error scraping IPL teams:", error);
    
    return {
      success: false,
      message: "Failed to scrape IPL teams",
      error: error.message
    };
  }
});