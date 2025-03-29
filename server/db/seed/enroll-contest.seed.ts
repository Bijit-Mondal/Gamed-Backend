import { seed, reset } from 'drizzle-seed';
import { db } from '../index';
import { contests, contestEnrollments, matches, userTeams } from '../schema';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed contest enrollments by distributing teams across contests
 * This function takes existing user teams and enrolls them in contests evenly
 */
export async function seedContestEnrollments() {
  console.log('🌱 Seeding contest enrollments...');

  try {
    // First, let's reset existing enrollments to avoid conflicts
    await resetContestEnrollments();
    
    // Get all upcoming matches
    const upcomingMatches = await db
      .select({
        matchId: matches.matchId,
      })
      .from(matches)
      .where(eq(matches.matchStatus, 'UPCOMING'));
    
    console.log(`Found ${upcomingMatches.length} upcoming matches`);

    // If no upcoming matches, exit
    if (upcomingMatches.length === 0) {
      console.log('No upcoming matches found. Skipping enrollment seeding.');
      return;
    }

    // For each match, get teams and contests
    for (const match of upcomingMatches) {
      console.log(`Processing match ${match.matchId}...`);
      
      // Get all teams for this match
      const matchTeams = await db
        .select({
          teamId: userTeams.teamId,
          userId: userTeams.userId,
        })
        .from(userTeams)
        .where(eq(userTeams.matchId, match.matchId));
      
      console.log(`Found ${matchTeams.length} teams for match ${match.matchId}`);
      
      if (matchTeams.length === 0) {
        console.log(`No teams found for match ${match.matchId}. Skipping.`);
        continue;
      }
      
      // Get all contests for this match
      const matchContests = await db
        .select({
          contestId: contests.contestId,
          contestType: contests.contestType,
          totalSpots: contests.totalSpots,
          filledSpots: contests.filledSpots,
        })
        .from(contests)
        .where(eq(contests.matchId, match.matchId));
      
      console.log(`Found ${matchContests.length} contests for match ${match.matchId}`);
      
      if (matchContests.length === 0) {
        console.log(`No contests found for match ${match.matchId}. Skipping.`);
        continue;
      }
      
      // Group contests by type for better distribution
      const contestsByType = matchContests.reduce((acc, contest) => {
        if (!acc[contest.contestType]) {
          acc[contest.contestType] = [];
        }
        acc[contest.contestType].push(contest);
        return acc;
      }, {} as Record<string, typeof matchContests>);
      
      // Prepare all enrollments for batch insert
      const allEnrollmentsToCreate = [];
      
      // Distribute teams across contests evenly
      // We'll try to ensure each contest gets some enrollments
      for (let i = 0; i < matchTeams.length; i++) {
        const team = matchTeams[i];
        
        // For each team, select contests from different types
        // This ensures users participate in a variety of contests
        // Calculate which contest types to use for this team
        const contestTypes = Object.keys(contestsByType);
        
        // Each team will be enrolled in 1-3 contests
        const enrollmentCount = Math.floor(Math.random() * 3) + 1;
        
        // Select random contest types for this team, ensuring we don't exceed the array length
        const selectedTypes = [];
        for (let j = 0; j < Math.min(enrollmentCount, contestTypes.length); j++) {
          // Select a random type that hasn't been selected yet
          const availableTypes = contestTypes.filter(type => !selectedTypes.includes(type));
          if (availableTypes.length === 0) break;
          
          const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
          selectedTypes.push(randomType);
        }
        
        // For each selected type, pick a random contest of that type
        for (const type of selectedTypes) {
          const availableContests = contestsByType[type].filter(contest => 
            contest.filledSpots < contest.totalSpots
          );
          
          if (availableContests.length === 0) continue;
          
          // Pick a random contest
          const contestIndex = Math.floor(Math.random() * availableContests.length);
          const selectedContest = availableContests[contestIndex];
          
          // Create enrollment
          allEnrollmentsToCreate.push({
            enrollmentId: uuidv4(),
            contestId: selectedContest.contestId,
            userTeamId: team.teamId,
            userId: team.userId,
            enrollmentTime: new Date().toISOString(),
            status: 'ACTIVE',
          });
          
          // Update filled spots count in our local copy
          selectedContest.filledSpots++;
        }
      }
      
      console.log(`Prepared ${allEnrollmentsToCreate.length} enrollments for match ${match.matchId}`);
      
      // Batch insert all enrollments
      if (allEnrollmentsToCreate.length > 0) {
        // Insert in batches to avoid excessive payload size
        const batchSize = 50;
        for (let i = 0; i < allEnrollmentsToCreate.length; i += batchSize) {
          const batch = allEnrollmentsToCreate.slice(i, i + batchSize);
          await db.insert(contestEnrollments).values(batch);
          console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allEnrollmentsToCreate.length / batchSize)}`);
        }
      }
      
      // Update contest filled spots in the database
      for (const type in contestsByType) {
        for (const contest of contestsByType[type]) {
          await db
            .update(contests)
            .set({ filledSpots: contest.filledSpots })
            .where(eq(contests.contestId, contest.contestId));
        }
      }
      
      console.log(`Updated contest filledSpots for match ${match.matchId}`);
    }

    console.log('✅ Contest enrollment seeding completed successfully');
  } catch (error) {
    console.error('Error seeding contest enrollments:', error);
    throw error;
  }
}

/**
 * Reset contest enrollments table
 */
export async function resetContestEnrollments() {
  try {
    console.log('🧹 Resetting contest enrollments table...');
    await reset(db, { contestEnrollments });
    console.log('✅ Contest enrollments reset completed');
  } catch (error) {
    console.error('Error resetting contest enrollments:', error);
    throw error;
  }
}

/**
 * Reset and recreate contest enrollments for testing
 */
export async function resetAndSeedContestEnrollments() {
  try {
    await resetContestEnrollments();
    await seedContestEnrollments();
  } catch (error) {
    console.error('Error resetting and seeding contest enrollments:', error);
    throw error;
  }
}

// For direct execution
if (require.main === module) {
  seedContestEnrollments()
    .then(() => {
      console.log('Contest enrollment seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Contest enrollment seeding failed:', error);
      process.exit(1);
    });
}