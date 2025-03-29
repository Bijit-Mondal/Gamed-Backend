import { seed, reset } from 'drizzle-seed';
import { db } from '../index';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Seed users for testing
 * Creates a variety of users with different balances and statuses
 */
export async function seedUsers(count: number = 100) {
  console.log(`🌱 Seeding ${count} users...`);

  try {
    // First, let's reset existing users to avoid conflicts
    await resetUsers();
    
    // Use Drizzle Seed to generate users with controlled randomization
    await seed(db, { users }).refine((f) => ({
      users: {
        count: count,
        columns: {
          // User handle will be first name + random number
          handle: f.weightedRandom([
            { 
              weight: 0.7, 
              value: f.firstName() 
            },
            { 
              weight: 0.3, 
              value: f.fullName() 
            }
          ]),
          
          // Email will be unique
          email: f.email(),
          
          // Total balance will follow a distribution
          totalBalance: f.weightedRandom([
            { weight: 0.5, value: f.int({ minValue: 100, maxValue: 1000 }) },         // 50% users with small balance
            { weight: 0.3, value: f.int({ minValue: 1001, maxValue: 5000 }) },        // 30% users with medium balance
            { weight: 0.15, value: f.int({ minValue: 5001, maxValue: 10000 }) },      // 15% users with high balance
            { weight: 0.05, value: f.int({ minValue: 10001, maxValue: 50000 }) },     // 5% users with very high balance
          ]),
          
          // Status will be mostly active
          status: f.weightedRandom([
            { weight: 0.9, value: f.default({ defaultValue: 'Active' }) },             // 90% active users
            { weight: 0.05, value: f.default({ defaultValue: 'Suspend' }) },           // 5% suspended users
            { weight: 0.05, value: f.default({ defaultValue: 'Pending' }) },           // 5% pending users
          ]),
        }
      }
    }));

    console.log('✅ User seeding completed successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
}

/**
 * Generate predefined users 
 * Creates a set of known users for testing
 */
export async function seedPredefinedUsers() {
  console.log('🌱 Seeding predefined users...');

  try {
    // Define preset users for testing
    const predefinedUsers = [
      { handle: 'admin', email: 'admin@gamezy.com', totalBalance: 100000, status: 'Active' },
      { handle: 'test_user', email: 'test@gamezy.com', totalBalance: 5000, status: 'Active' },
      { handle: 'premium', email: 'premium@gamezy.com', totalBalance: 25000, status: 'Active' },
      { handle: 'suspended', email: 'suspended@gamezy.com', totalBalance: 0, status: 'Suspend' },
      { handle: 'newbie', email: 'newbie@gamezy.com', totalBalance: 1000, status: 'Active' },
    ];

    // Insert each predefined user
    for (const user of predefinedUsers) {
      // Check if user already exists
      const existingUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      // Only insert if user doesn't exist
      if (existingUser.length === 0) {
        await db.insert(users).values(user);
        console.log(`Created predefined user: ${user.handle}`);
      } else {
        console.log(`Predefined user already exists: ${user.handle}`);
      }
    }

    console.log('✅ Predefined user seeding completed successfully');
  } catch (error) {
    console.error('Error seeding predefined users:', error);
    throw error;
  }
}

/**
 * Reset users table
 */
export async function resetUsers() {
  try {
    console.log('🧹 Resetting users table...');
    await reset(db, { users });
    console.log('✅ Users reset completed');
  } catch (error) {
    console.error('Error resetting users:', error);
    throw error;
  }
}

/**
 * Reset and seed users comprehensively
 * This includes both random and predefined users
 */
export async function resetAndSeedUsers(count: number = 100) {
  try {
    await resetUsers();
    // First seed predefined users to ensure they're always available
    await seedPredefinedUsers();
    // Then seed random users
    await seedUsers(count);
  } catch (error) {
    console.error('Error resetting and seeding users:', error);
    throw error;
  }
}

// For direct execution
if (require.main === module) {
  resetAndSeedUsers()
    .then(() => {
      console.log('User seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('User seeding failed:', error);
      process.exit(1);
    });
}