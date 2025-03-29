import { seed, reset } from 'drizzle-seed';
import { db } from '../index';
import { contests, matches } from '../schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed contests for upcoming matches
 * This function creates various contest types for all upcoming matches
 */
export async function seedContests() {
  console.log('🌱 Seeding contests for upcoming matches...');

  try {
    // First, let's reset existing contests to avoid conflicts
    await resetContests();
    
    // Get all upcoming matches
    const upcomingMatches = await db
      .select({
        matchId: matches.matchId,
        matchDate: matches.matchDate,
      })
      .from(matches)
      .where(eq(matches.matchStatus, 'UPCOMING'));

    console.log(`Found ${upcomingMatches.length} upcoming matches`);

    // If no upcoming matches, exit
    if (upcomingMatches.length === 0) {
      console.log('No upcoming matches found. Skipping contest seeding.');
      return;
    }

    // Prepare all contests at once rather than per match to avoid ID conflicts
    const allContestsToCreate = [];
    
    // Process each match and create contests
    for (const match of upcomingMatches) {
      const matchDate = new Date(match.matchDate);
      // Start time is 15 minutes before match time
      const startTime = new Date(matchDate.getTime() - 15 * 60 * 1000).toISOString();
      
      // Define contest types distribution
      const contestTypes = [
        ...Array(3).fill('MEGA'),             // 3 MEGA contests
        ...Array(10).fill('HEAD_TO_HEAD'),    // 10 HEAD_TO_HEAD contests
        ...Array(2).fill('PRACTICE'),         // 2 PRACTICE contests
        ...Array(2).fill('PREMIUM'),          // 2 PREMIUM contests
      ];
      
      // Create contests for this match
      for (const contestType of contestTypes) {
        // Generate specific contest details based on type
        const contestDetails = generateContestDetails(contestType);
        
        allContestsToCreate.push({
          contestId: uuidv4(), // Generate a truly unique UUID
          matchId: match.matchId,
          contestName: contestDetails.name,
          totalSpots: contestDetails.spots,
          filledSpots: 0,
          entryFee: contestDetails.fee,
          totalPrizePool: contestDetails.prize,
          contestType: contestType,
          startTime: startTime,
          status: 'CREATED',
        });
      }
      
      console.log(`Prepared contests for match ${match.matchId}`);
    }
    
    // Batch insert all contests
    if (allContestsToCreate.length > 0) {
      // Insert in batches of 50 to avoid excessive payload size
      const batchSize = 50;
      for (let i = 0; i < allContestsToCreate.length; i += batchSize) {
        const batch = allContestsToCreate.slice(i, i + batchSize);
        await db.insert(contests).values(batch);
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allContestsToCreate.length / batchSize)}`);
      }
      console.log(`Created ${allContestsToCreate.length} contests for ${upcomingMatches.length} matches`);
    }

    console.log('✅ Contest seeding completed successfully');
  } catch (error) {
    console.error('Error seeding contests:', error);
    throw error;
  }
}

/**
 * Generate contest details based on contest type
 */
function generateContestDetails(contestType: string) {
  // Define templates for each contest type
  const templates = {
    'MEGA': [
      { name: 'Mega Contest', spots: 10000, fee: '49', prize: '400000' },
      { name: 'Grand Mega', spots: 5000, fee: '199', prize: '900000' },
      { name: 'IPL Mega Special', spots: 2000, fee: '999', prize: '1800000' },
      { name: 'Big Profit', spots: 3000, fee: '149', prize: '500000' },
      { name: 'Big Cash Trophy', spots: 7500, fee: '299', prize: '1500000' },
    ],
    'HEAD_TO_HEAD': [
      { name: '1v1 Challenge', spots: 2, fee: '49', prize: '90' },
      { name: 'H2H Battle', spots: 2, fee: '99', prize: '180' },
      { name: 'Winner Takes All', spots: 2, fee: '499', prize: '900' },
      { name: 'Face-Off', spots: 2, fee: '199', prize: '360' },
      { name: 'Direct Duel', spots: 2, fee: '299', prize: '540' },
    ],
    'PRACTICE': [
      { name: 'Practice Round', spots: 500, fee: '0', prize: '0' },
      { name: 'Free Practice', spots: 1000, fee: '0', prize: '0' },
      { name: 'Skill Builder', spots: 2000, fee: '0', prize: '0' },
      { name: 'No Risk Practice', spots: 5000, fee: '0', prize: '0' },
    ],
    'PREMIUM': [
      { name: 'Premium Contest', spots: 100, fee: '1999', prize: '180000' },
      { name: 'Elite Premium', spots: 50, fee: '4999', prize: '230000' },
      { name: 'VIP Special', spots: 25, fee: '9999', prize: '230000' },
      { name: 'Pro League', spots: 75, fee: '2999', prize: '210000' },
    ],
  };
  
  // Select a random template for this contest type
  const typeTemplates = templates[contestType];
  const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  
  // Add a random number suffix for variety
  const randomSuffix = Math.floor(Math.random() * 100) + 1;
  
  return {
    name: `${template.name} #${randomSuffix}`,
    spots: template.spots,
    fee: template.fee,
    prize: template.prize
  };
}

/**
 * Reset contests table
 */
export async function resetContests() {
  try {
    console.log('🧹 Resetting contests table...');
    await reset(db, { contests });
    console.log('✅ Contests reset completed');
  } catch (error) {
    console.error('Error resetting contests:', error);
    throw error;
  }
}

/**
 * Reset and recreate contests for testing
 */
export async function resetAndSeedContests() {
  try {
    await resetContests();
    await seedContests();
  } catch (error) {
    console.error('Error resetting and seeding contests:', error);
    throw error;
  }
}

// For direct execution
if (require.main === module) {
  seedContests()
    .then(() => {
      console.log('Contest seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Contest seeding failed:', error);
      process.exit(1);
    });
}