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

// ---- v2 content lookups
import type {
  WingDef, PostDef, TraitDef, CharacterDef, DebateDef, AmendmentDef, ScenarioDef, DifficultyDef, PerkDef, AchievementDef, PostId,
} from './types';
export const WINGS: Record<string, WingDef> = Object.fromEntries(CONTENT.wings.map((w) => [w.id, w]));
export const POSTS: Record<string, PostDef> = Object.fromEntries(CONTENT.posts.map((p) => [p.id, p]));
export const TRAITS: Record<string, TraitDef> = Object.fromEntries(CONTENT.traits.map((t) => [t.id, t]));
export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(CONTENT.characters.map((c) => [c.id, c]));
export const DEBATES: Record<string, DebateDef> = Object.fromEntries(CONTENT.debates.map((d) => [d.id, d]));
export const AMENDMENTS: Record<string, AmendmentDef> = Object.fromEntries(CONTENT.amendments.map((a) => [a.id, a]));
export const SCENARIOS: Record<string, ScenarioDef> = Object.fromEntries(CONTENT.scenarios.map((s) => [s.id, s]));
export const DIFFICULTIES: Record<string, DifficultyDef> = Object.fromEntries(CONTENT.difficulties.map((d) => [d.id, d]));
export const PERKS: Record<string, PerkDef> = Object.fromEntries(CONTENT.perks.map((p) => [p.id, p]));
export const ACHIEVEMENTS: Record<string, AchievementDef> = Object.fromEntries(CONTENT.achievements.map((a) => [a.id, a]));
export const WING_IDS = CONTENT.wings.map((w) => w.id);
export const POST_IDS = CONTENT.posts.map((p) => p.id) as PostId[];
export const CHARACTER_IDS = CONTENT.characters.map((c) => c.id);
