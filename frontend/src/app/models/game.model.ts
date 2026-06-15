export interface InventoryItem {
  id: string;
  gameId: string;
  type:
    | 'FOOD'
    | 'WATER'
    | 'WOOD'
    | 'STONE'
    | 'FIBER'
    | 'RAW_FISH'
    | 'COOKED_FISH'
    | 'COCONUT'
    | 'DIRTY_WATER'
    | 'ANTIDOTE'
    | 'FIRST_AID_KIT'
    | 'BROKEN_RADIO'
    | 'RADIO_PARTS';
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuiltStructure {
  id: string;
  gameId: string;
  type:
    | 'CAMPFIRE'
    | 'FISHING_ROD'
    | 'BASIC_SHELTER'
    | 'WATER_COLLECTOR'
    | 'SIGNAL_FIRE'
    | 'STONE_KNIFE'
    | 'WOODEN_AXE'
    | 'LEAF_BASKET'
    | 'WATER_FILTER'
    | 'IMPROVED_SHELTER'
    | 'LARGE_WATER_COLLECTOR'
    | 'IMPROVISED_RAFT'
    | 'REPAIRED_RADIO'
    | 'SIGNAL_MIRROR';
  createdAt: string;
  updatedAt: string;
}

export type Weather = 'SUNNY' | 'CLOUDY' | 'RAIN' | 'STORM';
export type Zone = 'BEACH' | 'JUNGLE' | 'CAVE' | 'CLIFFS';
export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface DiscoveredZone {
  id: string;
  gameId: string;
  zone: Zone;
  discoveredAt: string;
}

export type EventLogType =
  | 'ACTION'
  | 'NIGHT_EVENT'
  | 'WEATHER'
  | 'BUILD'
  | 'DISCOVERY'
  | 'SURVIVAL'
  | 'RESCUE'
  | 'GAME_OVER'
  | 'VICTORY'
  | 'NARRATIVE';

export interface EventLog {
  id: string;
  gameId: string;
  day: number;
  type: EventLogType;
  message: string;
  createdAt: string;
}

export interface Game {
  id: string;
  day: number;
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  sanity: number;
  weather: Weather;
  difficulty: GameDifficulty;
  rescueProgress: number;
  actionsRemaining: number;
  isGameOver: boolean;
  isVictory: boolean;
  pendingDecisionEventKey: string | null;
  poisonDaysRemaining: number;
  poisonDamagePerDay: number;
  endingType: string | null;
  endingTitle: string | null;
  radioSignalDays: number;
  createdAt: string;
  updatedAt: string;
  inventoryItems: InventoryItem[];
  builtStructures: BuiltStructure[];
  discoveredZones: DiscoveredZone[];
  narrativeEvents: NarrativeEvent[];
  eventLogs: EventLog[];
}

export interface NarrativeEvent {
  id: string;
  gameId: string;
  eventKey: string;
  occurredAt: string;
  day: number;
}
