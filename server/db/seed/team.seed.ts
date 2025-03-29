import { db } from '../index';
import { contests, matches, players, squad, teams, userTeamPlayers, userTeams, users } from '../schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed fantasy teams for users
 * Creates teams for the first match's contests for all users
 */
export async function seedTeams() {
  console.log('🌱 Seeding fantasy teams for users...');

  try {
    // First, let's reset existing user teams to avoid conflicts
    await resetUserTeams();
    
    // Get all users
    const allUsers = await db.select({
      id: users.id,
      handle: users.handle,
      status: users.status
    }).from(users)
    .where(eq(users.status, 'Active'));

    console.log(`Found ${allUsers.length} active users`);
    
    // Get the first upcoming match
    const firstUpcomingMatch = await db
      .select({
        matchId: matches.matchId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(eq(matches.matchStatus, 'UPCOMING'))
      .orderBy(asc(matches.matchDate))
      .limit(1);

    if (firstUpcomingMatch.length === 0) {
      console.log('No upcoming matches found. Skipping team seeding.');
      return;
    }

    const matchId = firstUpcomingMatch[0].matchId;
    const homeTeamId = firstUpcomingMatch[0].homeTeamId;
    const awayTeamId = firstUpcomingMatch[0].awayTeamId;
    
    console.log(`Using match ${matchId} with teams ${homeTeamId} vs ${awayTeamId}`);

    // Get all contests for this match
    const matchContests = await db
      .select({
        contestId: contests.contestId,
        contestName: contests.contestName,
        contestType: contests.contestType,
      })
      .from(contests)
      .where(eq(contests.matchId, matchId));

    console.log(`Found ${matchContests.length} contests for match ${matchId}`);
    
    if (matchContests.length === 0) {
      console.log('No contests found for the match. Skipping team seeding.');
      return;
    }

    // Group contests by type
    const contestsByType: Record<string, typeof matchContests> = {};
    matchContests.forEach(contest => {
      if (!contestsByType[contest.contestType]) {
        contestsByType[contest.contestType] = [];
      }
      contestsByType[contest.contestType].push(contest);
    });
    
    // Get players from both teams for the match
    const homeTeamPlayers = await getTeamPlayers(homeTeamId);
    const awayTeamPlayers = await getTeamPlayers(awayTeamId);
    
    if (homeTeamPlayers.length < 6 || awayTeamPlayers.length < 6) {
      console.log('Not enough players in one of the teams. Skipping team seeding.');
      return;
    }
    
    console.log(`Home team has ${homeTeamPlayers.length} players, Away team has ${awayTeamPlayers.length} players`);

    // Create teams for each user
    const teamsCreated = {
      MEGA: 0,
      HEAD_TO_HEAD: 0,
      PRACTICE: 0,
      PREMIUM: 0,
      total: 0
    };

    for (const user of allUsers) {
      // Pick a random contest type for each user, distributing them among different contest types
      const contestTypeWeights = {
        'MEGA': 0.4,        // 40% users create MEGA contest teams
        'HEAD_TO_HEAD': 0.3, // 30% users create HEAD_TO_HEAD contest teams
        'PRACTICE': 0.2,     // 20% users create PRACTICE contest teams
        'PREMIUM': 0.1,      // 10% users create PREMIUM contest teams
      };
      
      // Select contest type based on weighted random choice
      const randomValue = Math.random();
      let cumulativeWeight = 0;
      let selectedContestType = 'MEGA'; // Default
      
      for (const [type, weight] of Object.entries(contestTypeWeights)) {
        cumulativeWeight += weight;
        if (randomValue <= cumulativeWeight) {
          selectedContestType = type;
          break;
        }
      }
      
      // Skip if no contests of this type
      if (!contestsByType[selectedContestType] || contestsByType[selectedContestType].length === 0) {
        continue;
      }
      
      // Select a random contest of the chosen type
      const randomContestIndex = Math.floor(Math.random() * contestsByType[selectedContestType].length);
      const selectedContest = contestsByType[selectedContestType][randomContestIndex];
      
      // Create a team for the user for this contest
      const teamId = uuidv4();
      const teamName = `${user.handle}'s ${selectedContestType} Team`;
      
      try {
        // Create team entry
        await db.insert(userTeams).values({
          teamId,
          userId: parseInt(user.id.toString()), // Convert to integer explicitly
          matchId,
          contestId: selectedContest.contestId, // Make sure to set the contestId
          teamName,
          totalPoints: '0',
          createdAt: new Date().toISOString(),
        });
        
        // Create balanced player selection (5-6 from each team)
        const totalHomePlayers = Math.floor(Math.random() * 2) + 5; // 5 or 6 players
        const totalAwayPlayers = 11 - totalHomePlayers; // Remaining players (5 or 6)
        
        // Guaranteed we won't have duplicates since we use a Set
        const selectedPlayerIds = new Set<string>();
        
        // Select players by type to ensure balance - at least 1 of each type, max 5 of each type
        const selectedPlayers = {
          BATSMAN: 0,
          BOWLER: 0,
          ALL_ROUNDER: 0,
          WICKET_KEEPER: 0,
        };
        
        // First, ensure at least 1 of each player type
        for (const playerType of ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']) {
          // Try to get from home team first
          const homePlayersOfType = homeTeamPlayers.filter(p => 
            p.type === playerType && !selectedPlayerIds.has(p.id)
          );
          
          if (homePlayersOfType.length > 0 && selectedPlayers[playerType] === 0) {
            const randomPlayerIndex = Math.floor(Math.random() * homePlayersOfType.length);
            selectedPlayerIds.add(homePlayersOfType[randomPlayerIndex].id);
            selectedPlayers[playerType]++;
          } else {
            // If not found in home team, get from away team
            const awayPlayersOfType = awayTeamPlayers.filter(p => 
              p.type === playerType && !selectedPlayerIds.has(p.id)
            );
            
            if (awayPlayersOfType.length > 0 && selectedPlayers[playerType] === 0) {
              const randomPlayerIndex = Math.floor(Math.random() * awayPlayersOfType.length);
              selectedPlayerIds.add(awayPlayersOfType[randomPlayerIndex].id);
              selectedPlayers[playerType]++;
            }
          }
        }
        
        // Now fill remaining slots, respecting team distribution and type limits
        let homePlayersCount = selectedPlayerIds.size - [...selectedPlayerIds].filter(id => 
          awayTeamPlayers.some(p => p.id === id)).length;
        let homePlayersRemaining = totalHomePlayers - homePlayersCount;
        
        let awayPlayersCount = selectedPlayerIds.size - homePlayersCount;
        let awayPlayersRemaining = totalAwayPlayers - awayPlayersCount;
        
        // Fill home team spots
        while (homePlayersRemaining > 0) {
          // Get eligible players not yet selected
          const eligibleHomePlayers = homeTeamPlayers.filter(p => 
            !selectedPlayerIds.has(p.id) && selectedPlayers[p.type] < 5
          );
          
          if (eligibleHomePlayers.length === 0) break;
          
          // Prioritize underrepresented player types
          const playerTypeWeights = {};
          for (const type in selectedPlayers) {
            playerTypeWeights[type] = 1 / (selectedPlayers[type] + 1); // Lower count gets higher weight
          }
          
          // Normalize weights
          const totalWeight = Object.values(playerTypeWeights).reduce((sum: number, w: number) => sum + w, 0);
          for (const type in playerTypeWeights) {
            playerTypeWeights[type] /= totalWeight;
          }
          
          // Select player type based on weighted probability
          const randomTypeValue = Math.random();
          let cumulativeTypeWeight = 0;
          let selectedType = Object.keys(playerTypeWeights)[0];
          
          for (const [type, weight] of Object.entries(playerTypeWeights)) {
            cumulativeTypeWeight += weight;
            if (randomTypeValue <= cumulativeTypeWeight) {
              selectedType = type;
              break;
            }
          }
          
          // Find players of this type
          const playersOfSelectedType = eligibleHomePlayers.filter(p => p.type === selectedType);
          
          if (playersOfSelectedType.length > 0) {
            const randomPlayerIndex = Math.floor(Math.random() * playersOfSelectedType.length);
            const selectedPlayer = playersOfSelectedType[randomPlayerIndex];
            
            selectedPlayerIds.add(selectedPlayer.id);
            selectedPlayers[selectedType]++;
            homePlayersRemaining--;
          } else {
            // If no players of the selected type, try any eligible type
            const randomIndex = Math.floor(Math.random() * eligibleHomePlayers.length);
            const alternatePlayer = eligibleHomePlayers[randomIndex];
            
            selectedPlayerIds.add(alternatePlayer.id);
            selectedPlayers[alternatePlayer.type]++;
            homePlayersRemaining--;
          }
        }
        
        // Fill away team spots
        while (awayPlayersRemaining > 0) {
          // Get eligible players not yet selected
          const eligibleAwayPlayers = awayTeamPlayers.filter(p => 
            !selectedPlayerIds.has(p.id) && selectedPlayers[p.type] < 5
          );
          
          if (eligibleAwayPlayers.length === 0) break;
          
          // Prioritize underrepresented player types
          const playerTypeWeights = {};
          for (const type in selectedPlayers) {
            playerTypeWeights[type] = 1 / (selectedPlayers[type] + 1); // Lower count gets higher weight
          }
          
          // Normalize weights
          const totalWeight = Object.values(playerTypeWeights).reduce((sum: number, w: number) => sum + w, 0);
          for (const type in playerTypeWeights) {
            playerTypeWeights[type] /= totalWeight;
          }
          
          // Select player type based on weighted probability
          const randomTypeValue = Math.random();
          let cumulativeTypeWeight = 0;
          let selectedType = Object.keys(playerTypeWeights)[0];
          
          for (const [type, weight] of Object.entries(playerTypeWeights)) {
            cumulativeTypeWeight += weight;
            if (randomTypeValue <= cumulativeTypeWeight) {
              selectedType = type;
              break;
            }
          }
          
          // Find players of this type
          const playersOfSelectedType = eligibleAwayPlayers.filter(p => p.type === selectedType);
          
          if (playersOfSelectedType.length > 0) {
            const randomPlayerIndex = Math.floor(Math.random() * playersOfSelectedType.length);
            const selectedPlayer = playersOfSelectedType[randomPlayerIndex];
            
            selectedPlayerIds.add(selectedPlayer.id);
            selectedPlayers[selectedType]++;
            awayPlayersRemaining--;
          } else {
            // If no players of the selected type, try any eligible type
            const randomIndex = Math.floor(Math.random() * eligibleAwayPlayers.length);
            const alternatePlayer = eligibleAwayPlayers[randomIndex];
            
            selectedPlayerIds.add(alternatePlayer.id);
            selectedPlayers[alternatePlayer.type]++;
            awayPlayersRemaining--;
          }
        }
        
        // If we don't have 11 players, add any remaining eligible players
        const remainingPlayerTypes = Object.keys(selectedPlayers).filter(type => selectedPlayers[type] < 5);
        
        while (selectedPlayerIds.size < 11 && remainingPlayerTypes.length > 0) {
          // Try adding from the home team first if we still need home players
          const needMoreHomePlayers = [...selectedPlayerIds].filter(id => 
            homeTeamPlayers.some(p => p.id === id)).length < totalHomePlayers;
          
          let possiblePlayers = [];
          
          if (needMoreHomePlayers) {
            possiblePlayers = homeTeamPlayers.filter(p => 
              !selectedPlayerIds.has(p.id) && 
              selectedPlayers[p.type] < 5
            );
          } else {
            possiblePlayers = awayTeamPlayers.filter(p => 
              !selectedPlayerIds.has(p.id) && 
              selectedPlayers[p.type] < 5
            );
          }
          
          if (possiblePlayers.length === 0) {
            // Try the other team
            possiblePlayers = needMoreHomePlayers ? 
              awayTeamPlayers.filter(p => !selectedPlayerIds.has(p.id) && selectedPlayers[p.type] < 5) :
              homeTeamPlayers.filter(p => !selectedPlayerIds.has(p.id) && selectedPlayers[p.type] < 5);
          }
          
          if (possiblePlayers.length === 0) {
            // No more eligible players
            break;
          }
          
          const randomIndex = Math.floor(Math.random() * possiblePlayers.length);
          const selectedPlayer = possiblePlayers[randomIndex];
          
          selectedPlayerIds.add(selectedPlayer.id);
          selectedPlayers[selectedPlayer.type]++;
        }
        
        // If we still don't have exactly 11 players, skip this team
        if (selectedPlayerIds.size !== 11) {
          console.log(`Could not create valid team for user ${user.handle}. Only found ${selectedPlayerIds.size} eligible players.`);
          // Delete the user team entry
          await db.delete(userTeams).where(eq(userTeams.teamId, teamId));
          continue;
        }
        
        // Convert the Set to an Array for easier processing
        const playerIdsArray = [...selectedPlayerIds];
        
        // Choose captain and vice-captain randomly
        const captainIndex = Math.floor(Math.random() * playerIdsArray.length);
        let viceCaptainIndex;
        do {
          viceCaptainIndex = Math.floor(Math.random() * playerIdsArray.length);
        } while (viceCaptainIndex === captainIndex);
        
        // Add players to the team
        const playerEntries = playerIdsArray.map((playerId, index) => ({
          userTeamId: teamId,
          playerId,
          isCaptain: index === captainIndex,
          isViceCaptain: index === viceCaptainIndex,
        }));
        
        // Insert all players at once
        await db.insert(userTeamPlayers).values(playerEntries);
        
        teamsCreated[selectedContestType]++;
        teamsCreated.total++;
        
        console.log(`Created ${selectedContestType} team for user ${user.handle}`);
      } catch (error) {
        console.error(`Error creating team for user ${user.handle}:`, error);
        // Clean up on error by deleting the team if it was created
        try {
          await db.delete(userTeams).where(eq(userTeams.teamId, teamId));
        } catch (cleanupError) {
          console.error(`Failed to clean up team ${teamId}:`, cleanupError);
        }
      }
    }
    
    console.log(`✅ Created ${teamsCreated.total} teams for ${allUsers.length} users:`);
    console.log(`  - MEGA: ${teamsCreated.MEGA}`);
    console.log(`  - HEAD_TO_HEAD: ${teamsCreated.HEAD_TO_HEAD}`);
    console.log(`  - PRACTICE: ${teamsCreated.PRACTICE}`);
    console.log(`  - PREMIUM: ${teamsCreated.PREMIUM}`);
    
  } catch (error) {
    console.error('Error seeding fantasy teams:', error);
    throw error;
  }
}

/**
 * Get players from a team
 */
async function getTeamPlayers(teamId: string) {
  const squadMembers = await db
    .select({
      id: players.playerId,
      name: players.fullName,
      type: players.playerType,
    })
    .from(squad)
    .innerJoin(players, eq(squad.playerId, players.playerId))
    .where(
      and(
        eq(squad.teamId, teamId),
        eq(squad.isActive, true)
      )
    );
  
  return squadMembers;
}

/**
 * Reset user teams and user team players tables
 */
async function resetUserTeams() {
  console.log('🧹 Resetting user teams and user team players...');
  
  try {
    // Delete all user team players first (foreign key constraint)
    await db.delete(userTeamPlayers);
    console.log('Deleted all user team players');
    
    // Then delete all user teams
    await db.delete(userTeams);
    console.log('Deleted all user teams');
  } catch (error) {
    console.error('Error resetting user teams:', error);
    throw error;
  }
}

/**
 * Reset and seed user teams
 */
export async function resetAndSeedTeams() {
  try {
    await resetUserTeams();
    await seedTeams();
  } catch (error) {
    console.error('Error in reset and seed teams:', error);
    throw error;
  }
}

// For direct execution
if (require.main === module) {
  seedTeams()
    .then(() => {
      console.log('Team seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Team seeding failed:', error);
      process.exit(1);
    });
}