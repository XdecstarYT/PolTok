// Typed content, imported from a copy of docs/game/content.json.
import raw from './content.json';
import type { Content, LawDef, EventDef, RivalDef, GroupDef, RegionDef } from './types';

/** All game content (eras, groups, regions, ideologies, rivals, laws, events). */
export const CONTENT = raw as unknown as Content;
/** Lookup tables by id. */
export const LAWS: Record<string, LawDef> = Object.fromEntries(CONTENT.laws.map((l) => [l.id, l]));
export const EVENTS: Record<string, EventDef> = Object.fromEntries(CONTENT.events.map((e) => [e.id, e]));
export const RIVALS: Record<string, RivalDef> = Object.fromEntries(CONTENT.rivals.map((r) => [r.id, r]));
export const GROUPS: Record<string, GroupDef> = Object.fromEntries(CONTENT.groups.map((g) => [g.id, g]));
export const REGIONS: Record<string, RegionDef> = Object.fromEntries(CONTENT.regions.map((r) => [r.id, r]));
export const GROUP_IDS = CONTENT.groups.map((g) => g.id);
export const REGION_IDS = CONTENT.regions.map((r) => r.id);
export const RIVAL_IDS = CONTENT.rivals.map((r) => r.id);
