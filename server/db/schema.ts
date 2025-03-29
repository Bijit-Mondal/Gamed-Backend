import { sql } from "drizzle-orm";
import { integer, text, sqliteTable as table, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = table("gamezy_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull(),
  email: text("email").notNull(),
  totalBalance: integer("total_balance").notNull().default(0),
  status: text("status", { enum: ["Active", "Suspend", "Pending"] }).notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (user) => {
  return {
    emailIndex: uniqueIndex("email_idx").on(user.email)
  };
});

export const players = table("gamezy_players", {
  playerId: text("player_id").primaryKey(),
  fullName: text("full_name").notNull(),
  country: text("country").notNull(),
  playerType: text("player_type", { enum: ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"] }).notNull(),
  dateOfBirth: text("date_of_birth"),
  battingStyle: text("batting_style"),
  bowlingStyle: text("bowling_style"),
  playerRole: text("player_role"),
  baseCreditValue: integer("base_credit_value").notNull(),
});

export const teams = table("gamezy_teams", {
  teamId: text("team_id").primaryKey(),
  teamName: text("team_name").notNull(),
  country: text("country").notNull(),
  logoUrl: text("logo_url"),
  teamType: text("team_type", { enum: ["NATIONAL", "IPL", "T20_LEAGUE"] }).notNull(),
});

export const squad = table("gamezy_squad", {
  playerId: text("player_id").references(() => players.playerId),
  teamId: text("team_id").references(() => teams.teamId),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  joinedDate: text("joined_date").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const matches = table("gamezy_matches", {
  matchId: text("match_id").primaryKey(),
  homeTeamId: text("home_team_id").references(() => teams.teamId),
  awayTeamId: text("away_team_id").references(() => teams.teamId),
  matchDate: text("match_date").notNull(),
  matchType: text("match_type", { enum: ["T20", "ODI", "TEST", "IPL"] }).notNull(),
  venue: text("venue"),
  matchStatus: text("match_status", { enum: ["UPCOMING", "LIVE", "COMPLETED", "CANCELED"] }).notNull(),
  tossWinnerTeamId: text("toss_winner_team_id").references(() => teams.teamId),
  winningTeamId: text("winning_team_id").references(() => teams.teamId),
});

export const playerPerformances = table("gamezy_player_performances", {
  performanceId: text("performance_id").primaryKey(),
  matchId: text("match_id").references(() => matches.matchId),
  playerId: text("player_id").references(() => players.playerId),
  runsScored: integer("runs_scored").default(0),
  ballsFaced: integer("balls_faced").default(0),
  wicketsTaken: integer("wickets_taken").default(0),
  oversBowled: text("overs_bowled").default("0"),
  catches: integer("catches").default(0),
  stumpings: integer("stumpings").default(0),
  runOuts: integer("run_outs").default(0),
  strikeRate: text("strike_rate"),
  economyRate: text("economy_rate"),
  totalFantasyPoints: text("total_fantasy_points").default("0"),
});


export const contests = table("gamezy_contests", {
  contestId: text("contest_id").primaryKey(),
  matchId: text("match_id").references(() => matches.matchId),
  contestName: text("contest_name").notNull(),
  totalSpots: integer("total_spots").notNull(),
  filledSpots: integer("filled_spots").default(0),
  entryFee: text("entry_fee").notNull(),
  totalPrizePool: text("total_prize_pool").notNull(),
  contestType: text("contest_type", { enum: ["MEGA", "HEAD_TO_HEAD", "PRACTICE", "PREMIUM"] }).notNull(),
  startTime: text("start_time").notNull(),
  status: text("status", { enum: ["CREATED", "RUNNING", "COMPLETED", "CANCELED"] }).notNull().default("CREATED"),
});

export const userTeams = table("gamezy_user_teams", {
  teamId: text("team_id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  matchId: text("match_id").references(() => matches.matchId),
  teamName: text("team_name", { length: 50 }),
  totalPoints: text("total_points").default("0"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contestEnrollments = table("gamezy_contest_enrollments", {
  enrollmentId: text("enrollment_id").primaryKey(),
  contestId: text("contest_id").references(() => contests.contestId).notNull(),
  userTeamId: text("user_team_id").references(() => userTeams.teamId).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  enrollmentTime: text("enrollment_time").notNull().default(sql`CURRENT_TIMESTAMP`),
  rank: integer("rank"),
  winnings: text("winnings"),
  status: text("status", { enum: ["ACTIVE", "CANCELED"] }).notNull().default("ACTIVE"),
}, (enrollment) => {
  return {
    uniqueEnrollment: uniqueIndex("unique_enrollment_idx").on(enrollment.contestId, enrollment.userTeamId),
  };
});

export const userTeamPlayers = table("gamezy_user_team_players", {
  userTeamId: text("user_team_id").references(() => userTeams.teamId),
  playerId: text("player_id").references(() => players.playerId),
  isCaptain: integer("is_captain", { mode: "boolean" }).default(false),
  isViceCaptain: integer("is_vice_captain", { mode: "boolean" }).default(false),
}, (userTeamPlayer) => {
  return {
    pk: uniqueIndex("user_team_player_pk").on(userTeamPlayer.userTeamId, userTeamPlayer.playerId),
  };
});

