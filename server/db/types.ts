import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { users, players, teams, squad } from './schema';

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

