import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { users, players, teams, squad, matches, contests, userTeams, userTeamPlayers } from './schema';

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const updateUserSchema = createUpdateSchema(users);

export type TInsertUser = z.infer<typeof insertUserSchema>;
export type TSelectUser = z.infer<typeof selectUserSchema>;
export type TUpdateUser = z.infer<typeof updateUserSchema>;

export const insertPlayerSchema = createInsertSchema(players);
export const selectPlayerSchema = createSelectSchema(players);
export const updatePlayerSchema = createUpdateSchema(players);

export type TInsertPlayer = z.infer<typeof insertPlayerSchema>;
export type TSelectPlayer = z.infer<typeof selectPlayerSchema>;
export type TUpdatePlayer = z.infer<typeof updatePlayerSchema>;

export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export const updateTeamSchema = createUpdateSchema(teams);

export type TInsertTeam = z.infer<typeof insertTeamSchema>;
export type TSelectTeam = z.infer<typeof selectTeamSchema>;
export type TUpdateTeam = z.infer<typeof updateTeamSchema>;

export const insertSquadSchema = createInsertSchema(squad);
export const selectSquadSchema = createSelectSchema(squad);
export const updateSquadSchema = createUpdateSchema(squad);

export type TInsertSquad = z.infer<typeof insertSquadSchema>;
export type TSelectSquad = z.infer<typeof selectSquadSchema>;
export type TUpdateSquad = z.infer<typeof updateSquadSchema>;

export const insertMatchSchema = createInsertSchema(matches);
export const selectMatchSchema = createSelectSchema(matches);
export const updateMatchSchema = createUpdateSchema(matches);

export type TInsertMatch = z.infer<typeof insertMatchSchema>;
export type TSelectMatch = z.infer<typeof selectMatchSchema>;
export type TUpdateMatch = z.infer<typeof updateMatchSchema>;

export const insertContestSchema = createInsertSchema(contests);
export const selectContestSchema = createSelectSchema(contests);
export const updateContestSchema = createUpdateSchema(contests);

export type TInsertContest = z.infer<typeof insertContestSchema>;
export type TSelectContest = z.infer<typeof selectContestSchema>;
export type TUpdateContest = z.infer<typeof updateContestSchema>;

export const insertUserTeamSchema = createInsertSchema(userTeams);
export const selectUserTeamSchema = createSelectSchema(userTeams);
export const updateUserTeamSchema = createUpdateSchema(userTeams);

export type TInsertUserTeam = z.infer<typeof insertUserTeamSchema>;
export type TSelectUserTeam = z.infer<typeof selectUserTeamSchema>;
export type TUpdateUserTeam = z.infer<typeof updateUserTeamSchema>;

export const insertUserTeamPlayerSchema = createInsertSchema(userTeamPlayers);
export const selectUserTeamPlayerSchema = createSelectSchema(userTeamPlayers);
export const updateUserTeamPlayerSchema = createUpdateSchema(userTeamPlayers);

export type TInsertUserTeamPlayer = z.infer<typeof insertUserTeamPlayerSchema>;
export type TSelectUserTeamPlayer = z.infer<typeof selectUserTeamPlayerSchema>;
export type TUpdateUserTeamPlayer = z.infer<typeof updateUserTeamPlayerSchema>;
