import { prisma } from '../prisma/client.js';
import { gameDetailsInclude } from './game.service.js';
import {
  maybeRollNarrativeEvent,
  maybeRollDecisionEvent,
  persistNarrativeEvent,
  persistPendingDecisionEvent,
  applyPositiveResource,
  applyNarrativeRegularStatDelta,
  rollExplorationAntidote,
  NarrativeEventResult,
  decisionEvents,
} from './narrative-event.service.js';

export const allowedActions = [
  'FORAGE',
  'SEARCH_WATER',
  'REST',
  'EXPLORE',
  'FISH',
  'LEAVE_ISLAND',
  'SEND_RADIO_SIGNAL',
] as const;
export const allowedExploreZones = ['BEACH', 'JUNGLE', 'CAVE', 'CLIFFS'] as const;

export type GameAction = (typeof allowedActions)[number];
export type ExploreZone = (typeof allowedExploreZones)[number];
type StatChanges = Partial<Record<'hunger' | 'thirst' | 'energy' | 'sanity', number>>;
type ResourceChanges = Partial<
  Record<
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
    | 'FIRST_AID_KIT',
    number
  >
>;
type StructureType =
  | 'CAMPFIRE'
  | 'FISHING_ROD'
  | 'BASIC_SHELTER'
  | 'WATER_COLLECTOR'
  | 'STONE_KNIFE'
  | 'WOODEN_AXE'
  | 'LEAF_BASKET'
  | 'WATER_FILTER'
  | 'IMPROVED_SHELTER'
  | 'LARGE_WATER_COLLECTOR'
  | 'IMPROVISED_RAFT'
  | 'REPAIRED_RADIO'
  | 'SIGNAL_MIRROR';
type ZoneType = 'BEACH' | 'JUNGLE' | 'CAVE' | 'CLIFFS';
type DiscoverableZone = Exclude<ZoneType, 'BEACH'>;
type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

interface ActionOutcome {
  resources: ResourceChanges;
  message: string;
  actionMessage: string;
  discoveredZone: DiscoverableZone | null;
  discoveryMessage: string | null;
}

export type ActionResult =
  | {
      status: 'performed';
      game: unknown;
      message: string;
      eventMessages?: string[];
      importantEvent?: { title: string; message: string };
    }
  | { status: 'not_found' }
  | { status: 'game_over' }
  | { status: 'no_actions_remaining' }
  | { status: 'missing_tool' }
  | { status: 'zone_not_discovered' };

const zoneUnlocks: Partial<Record<ExploreZone, DiscoverableZone>> = {
  BEACH: 'JUNGLE',
  JUNGLE: 'CAVE',
  CAVE: 'CLIFFS',
};

const zoneDiscoveryMessages: Record<DiscoverableZone, string> = {
  JUNGLE: 'Has descubierto la jungla.',
  CAVE: 'Has encontrado la entrada de una cueva.',
  CLIFFS: 'Has llegado a unos acantilados.',
};

const baseStatChanges: Record<GameAction, StatChanges> = {
  FORAGE: {
    energy: -8,
    hunger: -3,
    thirst: -3,
  },
  SEARCH_WATER: {
    energy: -8,
    hunger: -3,
    thirst: -3,
  },
  REST: {
    energy: 25,
    hunger: -5,
    thirst: -5,
    sanity: 5,
  },
  EXPLORE: {
    energy: -15,
    hunger: -5,
    thirst: -5,
    sanity: 5,
  },
  FISH: {
    energy: -12,
    hunger: -4,
    thirst: -4,
  },
  LEAVE_ISLAND: {},
  SEND_RADIO_SIGNAL: {
    energy: -6,
    hunger: -2,
    thirst: -2,
  },
};

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

function hasStructure(structures: Set<StructureType>, structure: StructureType) {
  return structures.has(structure);
}

function hasZone(zones: Set<ZoneType>, zone: ZoneType) {
  return zones.has(zone);
}

function rollQuantity(chances: Array<{ max: number; quantity: number }>) {
  const roll = Math.random();
  return chances.find((chance) => roll < chance.max)?.quantity ?? 0;
}

function scaleWear(value: number, difficulty: GameDifficulty) {
  if (value >= 0) {
    return value;
  }

  if (difficulty === 'EASY') {
    return Math.trunc(value * 0.75);
  }

  if (difficulty === 'HARD') {
    return Math.floor(value * 1.25);
  }

  return value;
}

function describeResources(resources: ResourceChanges) {
  const labels: Record<keyof ResourceChanges, string> = {
    FOOD: 'comida',
    WATER: 'agua',
    WOOD: 'madera',
    STONE: 'piedra',
    FIBER: 'fibra',
    RAW_FISH: 'pescado crudo',
    COOKED_FISH: 'pescado cocinado',
    COCONUT: 'coco',
    DIRTY_WATER: 'agua no potable',
    ANTIDOTE: 'cura',
    FIRST_AID_KIT: 'botiquín',
  };

  return Object.entries(resources)
    .filter(([, quantity]) => quantity > 0)
    .map(([type, quantity]) => `${quantity} ${labels[type as keyof ResourceChanges]}`)
    .join(', ');
}

function getStatChanges(
  action: GameAction,
  structures: Set<StructureType>,
  difficulty: GameDifficulty,
): StatChanges {
  if (
    action === 'REST' &&
    hasStructure(structures, 'IMPROVED_SHELTER') &&
    hasStructure(structures, 'CAMPFIRE')
  ) {
    return {
      energy: 55,
      hunger: -3,
      thirst: -3,
      sanity: 20,
    };
  }

  if (action === 'REST' && hasStructure(structures, 'IMPROVED_SHELTER')) {
    return {
      energy: 50,
      hunger: -3,
      thirst: -3,
      sanity: 16,
    };
  }

  if (
    action === 'REST' &&
    hasStructure(structures, 'BASIC_SHELTER') &&
    hasStructure(structures, 'CAMPFIRE')
  ) {
    return {
      energy: 45,
      hunger: -4,
      thirst: -4,
      sanity: 15,
    };
  }

  if (action === 'REST' && hasStructure(structures, 'BASIC_SHELTER')) {
    return {
      energy: 40,
      hunger: -4,
      thirst: -4,
      sanity: 12,
    };
  }

  if (action === 'REST' && hasStructure(structures, 'CAMPFIRE')) {
    return {
      ...baseStatChanges.REST,
      sanity: (baseStatChanges.REST.sanity ?? 0) + 5,
    };
  }

  const baseChanges = baseStatChanges[action];

  return Object.fromEntries(
    Object.entries(baseChanges).map(([stat, value]) => [stat, scaleWear(value, difficulty)]),
  ) as StatChanges;
}

function rollZoneDiscovery(
  zones: Set<ZoneType>,
  exploredZone: ExploreZone = 'BEACH',
): DiscoverableZone | null {
  const nextZone = zoneUnlocks[exploredZone];

  if (!nextZone || Math.random() >= 0.35) {
    return null;
  }

  return hasZone(zones, nextZone) ? null : nextZone;
}

function rollRange(max: number) {
  return Math.floor(Math.random() * (max + 1));
}

function addResource(resources: ResourceChanges, type: keyof ResourceChanges, quantity: number) {
  if (quantity <= 0) {
    return;
  }

  resources[type] = (resources[type] ?? 0) + quantity;
}

function singleMessageOutcome(message: string, resources: ResourceChanges = {}): ActionOutcome {
  return {
    resources,
    message,
    actionMessage: message,
    discoveredZone: null,
    discoveryMessage: null,
  };
}

function rollAction(
  action: GameAction,
  structures: Set<StructureType>,
  zones: Set<ZoneType>,
  difficulty: GameDifficulty,
  exploreZone: ExploreZone,
): ActionOutcome {
  if (action === 'FORAGE') {
    const hasJungle = hasZone(zones, 'JUNGLE');
    const hasStoneKnife = hasStructure(structures, 'STONE_KNIFE');
    const hasLeafBasket = hasStructure(structures, 'LEAF_BASKET');
    const foodChances =
      difficulty === 'EASY'
        ? [
            { max: 0.2, quantity: 0 },
            { max: 0.55, quantity: 1 },
            { max: 0.85, quantity: 2 },
            { max: 1, quantity: 3 },
          ]
        : difficulty === 'HARD'
          ? [
              { max: 0.4, quantity: 0 },
              { max: 0.72, quantity: 1 },
              { max: 0.94, quantity: 2 },
              { max: 1, quantity: 3 },
            ]
          : [
              { max: 0.3, quantity: 0 },
              { max: 0.65, quantity: 1 },
              { max: 0.9, quantity: 2 },
              { max: 1, quantity: 3 },
            ];
    let food = rollQuantity(foodChances);
    const fiberChance = (hasStoneKnife ? 0.35 : 0.25) + (difficulty === 'EASY' ? 0.05 : 0) - (difficulty === 'HARD' ? 0.05 : 0);
    let fiber = Math.random() < fiberChance ? 1 : 0;

    if (hasJungle && food > 0) {
      food += 1;
    }

    if (food > 0 && hasStoneKnife && Math.random() < 0.1) {
      food += 1;
    }

    if (food > 0 && hasLeafBasket && Math.random() < 0.25) {
      food += 1;
    }

    const resources: ResourceChanges = {};

    if (food > 0) {
      resources.FOOD = food;
    }

    if (fiber > 0) {
      resources.FIBER = fiber;
    }

    if (Math.random() < (difficulty === 'EASY' ? 0.18 : difficulty === 'HARD' ? 0.08 : 0.12)) {
      resources.COCONUT = 1;
    }

    return singleMessageOutcome(
      food > 0 || fiber > 0 || resources.COCONUT
        ? `Has encontrado ${describeResources(resources)}.`
        : 'No has encontrado nada comestible.',
      resources,
    );
  }

  if (action === 'SEARCH_WATER') {
    const hasWaterCollector = hasStructure(structures, 'WATER_COLLECTOR');
    const hasWaterFilter = hasStructure(structures, 'WATER_FILTER');
    const waterChances =
      difficulty === 'EASY'
        ? [
            { max: 0.2, quantity: 0 },
            { max: 0.62, quantity: 1 },
            { max: 0.92, quantity: 2 },
            { max: 1, quantity: 3 },
          ]
        : difficulty === 'HARD'
          ? [
              { max: 0.4, quantity: 0 },
              { max: 0.76, quantity: 1 },
              { max: 0.97, quantity: 2 },
              { max: 1, quantity: 3 },
            ]
          : [
              { max: 0.3, quantity: 0 },
              { max: 0.7, quantity: 1 },
              { max: 0.95, quantity: 2 },
              { max: 1, quantity: 3 },
            ];
    let water = rollQuantity(waterChances);

    if (water === 0 && hasWaterCollector && Math.random() < 0.15) {
      water = 1;
    }

    if (water > 0 && hasWaterFilter) {
      water += 1;
    }

    if (water === 0 && Math.random() < (difficulty === 'EASY' ? 0.35 : difficulty === 'HARD' ? 0.55 : 0.45)) {
      const dirtyWater = Math.random() < 0.8 ? 1 : 2;

      return singleMessageOutcome(
        `Has encontrado ${dirtyWater} agua no potable.`,
        { DIRTY_WATER: dirtyWater },
      );
    }

    return singleMessageOutcome(
      water > 0 ? `Has conseguido ${water} agua potable.` : 'No has encontrado agua potable.',
      water > 0 ? { WATER: water } : {},
    );
  }

  if (action === 'EXPLORE') {
    const hasWoodenAxe = hasStructure(structures, 'WOODEN_AXE');
    const discoveredZone = rollZoneDiscovery(zones, exploreZone);
    const resources: ResourceChanges = {};
    let actionMessage = '';

    if (exploreZone === 'BEACH') {
      addResource(resources, 'WOOD', rollRange(2));
      addResource(
        resources,
        'WATER',
        rollQuantity([
          { max: difficulty === 'HARD' ? 0.45 : 0.35, quantity: 0 },
          { max: difficulty === 'EASY' ? 0.85 : 0.78, quantity: 1 },
          { max: 1, quantity: 2 },
        ]),
      );

      if (Math.random() < (difficulty === 'EASY' ? 0.65 : difficulty === 'HARD' ? 0.35 : 0.5)) {
        addResource(resources, 'FIBER', 1);
      }

      if (Math.random() < (difficulty === 'EASY' ? 0.28 : difficulty === 'HARD' ? 0.12 : 0.2)) {
        addResource(resources, 'COCONUT', Math.random() < 0.7 ? 1 : 2);
      }

      actionMessage =
        describeResources(resources).length > 0
          ? `Has explorado la playa y encontrado restos arrastrados por la marea: ${describeResources(resources)}.`
          : 'Has explorado la playa, pero la marea no ha traído nada útil.';
    }

    if (exploreZone === 'JUNGLE') {
      addResource(resources, 'WOOD', rollRange(2));
      addResource(
        resources,
        'FOOD',
        rollQuantity([
          { max: difficulty === 'HARD' ? 0.35 : 0.2, quantity: 0 },
          { max: difficulty === 'EASY' ? 0.72 : 0.62, quantity: 1 },
          { max: 0.92, quantity: 2 },
          { max: 1, quantity: 3 },
        ]),
      );
      addResource(resources, 'FIBER', Math.random() < (difficulty === 'HARD' ? 0.45 : 0.75) ? 1 : 0);

      actionMessage =
        describeResources(resources).length > 0
          ? `Te adentraste en la jungla y encontraste ${describeResources(resources)}.`
          : 'Te adentraste en la jungla, pero no encontraste nada aprovechable.';
    }

    if (exploreZone === 'CAVE') {
      addResource(
        resources,
        'STONE',
        rollQuantity([
          { max: 0.12, quantity: 0 },
          { max: 0.42, quantity: 1 },
          { max: 0.82, quantity: 2 },
          { max: 1, quantity: 3 },
        ]),
      );
      addResource(resources, 'FIBER', Math.random() < 0.2 ? 1 : 0);

      if (Math.random() < (difficulty === 'EASY' ? 0.28 : difficulty === 'HARD' ? 0.12 : 0.2)) {
        addResource(resources, 'WATER', 1);
      }

      actionMessage =
        describeResources(resources).length > 0
          ? `Exploraste la cueva y encontraste ${describeResources(resources)}.`
          : 'Exploraste la cueva, pero no encontraste nada que llevarte.';
    }

    if (exploreZone === 'CLIFFS') {
      addResource(resources, 'WOOD', rollRange(2));
      addResource(resources, 'STONE', rollRange(2));

      actionMessage =
        describeResources(resources).length > 0
          ? `Subiste a los acantilados y viste el horizonte. También encontraste ${describeResources(resources)}.`
          : 'Subiste a los acantilados y viste el horizonte.';
    }

    if (resources.WOOD && hasWoodenAxe) {
      resources.WOOD += 1;
    }

    if (difficulty === 'EASY' && resources.WOOD && Math.random() < 0.15) {
      resources.WOOD += 1;
    }

    if (difficulty === 'HARD' && resources.WOOD && resources.WOOD > 0 && Math.random() < 0.15) {
      resources.WOOD -= 1;
    }

    const discoveryMessage = discoveredZone ? zoneDiscoveryMessages[discoveredZone] : null;

    return {
      resources,
      message: [actionMessage, discoveryMessage].filter(Boolean).join(' '),
      actionMessage,
      discoveredZone,
      discoveryMessage,
    };

    /*
    const hasCave = hasZone(zones, 'CAVE');
    const hasAxe = hasStructure(structures, 'WOODEN_AXE');
    const discoveredZone = rollZoneDiscovery(zones);
    let wood = Math.floor(Math.random() * 4);
    let stone = Math.floor(Math.random() * 3);
    const fiber = Math.random() < (difficulty === 'EASY' ? 0.6 : difficulty === 'HARD' ? 0.4 : 0.5) ? 1 : 0;

    if (difficulty === 'EASY' && Math.random() < 0.15) {
      wood += 1;
    }

    if (difficulty === 'HARD' && wood > 0 && Math.random() < 0.15) {
      wood -= 1;
    }

    if (wood > 0 && hasAxe) {
      wood += 1;
    }

    if (stone > 0 && hasCave) {
      stone += 1;
    }

    const resources: ResourceChanges = {};

    if (wood > 0) {
      resources.WOOD = wood;
    }

    if (stone > 0) {
      resources.STONE = stone;
    }

    if (fiber > 0) {
      resources.FIBER = fiber;
    }

    const actionMessage =
      wood > 0 || stone > 0 || fiber > 0
        ? `Has encontrado ${describeResources(resources)}.`
        : 'La exploración no dio resultados.';
    const discoveryMessage = discoveredZone ? zoneDiscoveryMessages[discoveredZone] : null;

    return {
      resources,
      message: [actionMessage, discoveryMessage].filter(Boolean).join(' '),
      actionMessage,
      discoveredZone,
      discoveryMessage,
    };
    */
  }

  if (action === 'FISH') {
    const success = Math.random() < 0.75;
    const rawFish = success ? rollQuantity([
      { max: 0.45, quantity: 1 },
      { max: 0.85, quantity: 2 },
      { max: 1, quantity: 3 },
    ]) : 0;

    return singleMessageOutcome(
      success
        ? 'Has pescado varios peces crudos.'
        : 'No has conseguido pescar nada.',
      rawFish > 0 ? { RAW_FISH: rawFish } : {},
    );
  }

  if (hasStructure(structures, 'IMPROVED_SHELTER') && hasStructure(structures, 'CAMPFIRE')) {
    return singleMessageOutcome('Has dormido protegido junto a la fogata y el refugio mejorado.');
  }

  if (hasStructure(structures, 'IMPROVED_SHELTER')) {
    return singleMessageOutcome('Tu refugio mejorado te protege mejor durante la noche.');
  }

  if (hasStructure(structures, 'BASIC_SHELTER') && hasStructure(structures, 'CAMPFIRE')) {
    return singleMessageOutcome('Has dormido protegido junto a la fogata.');
  }

  if (hasStructure(structures, 'BASIC_SHELTER')) {
    return singleMessageOutcome('Has descansado mejor gracias al refugio.');
  }

  if (hasStructure(structures, 'CAMPFIRE')) {
    return singleMessageOutcome(
      'Has descansado junto a la fogata. El fuego te devuelve algo de calma.',
    );
  }

  return singleMessageOutcome('Has descansado junto al refugio.');
}

export function isGameAction(action: unknown): action is GameAction {
  return typeof action === 'string' && allowedActions.includes(action as GameAction);
}

export function isExploreZone(zone: unknown): zone is ExploreZone {
  return typeof zone === 'string' && allowedExploreZones.includes(zone as ExploreZone);
}

export async function performGameAction(
  gameId: string,
  action: GameAction,
  zone: ExploreZone | null = null,
): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    include: {
      builtStructures: true,
      discoveredZones: true,
      inventoryItems: true,
      narrativeEvents: true,
    },
  });

  if (!game) {
    return { status: 'not_found' };
  }

  if (game.isGameOver || game.isVictory) {
    return { status: 'game_over' };
  }

  if (game.actionsRemaining <= 0) {
    return { status: 'no_actions_remaining' };
  }

  const structures = new Set(
    game.builtStructures.map((structure) => structure.type as StructureType),
  );
  const zones = new Set(game.discoveredZones.map((zone) => zone.zone as ZoneType));

  if (action === 'FISH' && (!hasStructure(structures, 'FISHING_ROD') || !hasZone(zones, 'BEACH'))) {
    return { status: 'missing_tool' };
  }

  if (action === 'LEAVE_ISLAND' && !hasStructure(structures, 'IMPROVISED_RAFT')) {
    return { status: 'missing_tool' };
  }

  if (action === 'SEND_RADIO_SIGNAL' && !hasStructure(structures, 'REPAIRED_RADIO')) {
    return { status: 'missing_tool' };
  }

  const exploreZone = action === 'EXPLORE' ? zone ?? 'BEACH' : 'BEACH';

  if (action === 'EXPLORE' && !hasZone(zones, exploreZone)) {
    return { status: 'zone_not_discovered' };
  }

  if (action === 'LEAVE_ISLAND') {
    return attemptRaftEnding(gameId, game);
  }

  if (action === 'SEND_RADIO_SIGNAL') {
    return sendRadioSignal(gameId, game);
  }

  const difficulty = game.difficulty as GameDifficulty;
  const changes = getStatChanges(action, structures, difficulty);
  const outcome = rollAction(action, structures, zones, difficulty, exploreZone);
  const decisionEvent =
    action === 'EXPLORE' || action === 'FORAGE'
      ? maybeRollDecisionEvent(game, action === 'EXPLORE' ? exploreZone : null)
      : null;
  const narrativeEvent = decisionEvent || game.pendingDecisionEventKey
    ? null
    : action === 'EXPLORE'
      ? maybeRollNarrativeEvent(game, 'EXPLORE', exploreZone)
      : action === 'FORAGE'
        ? maybeRollNarrativeEvent(game, 'FORAGE')
        : null;
  const antidoteEvent = !decisionEvent && !narrativeEvent && action === 'EXPLORE'
    ? rollExplorationAntidote(game)
    : null;

  return prisma.$transaction(async (transaction) => {
    for (const [type, quantity] of Object.entries(outcome.resources)) {
      if ((type === 'ANTIDOTE' || type === 'FIRST_AID_KIT') && quantity > 0) {
        await applyPositiveResource(transaction, gameId, type, quantity);
        continue;
      }

      await transaction.inventoryItem.upsert({
        where: {
          gameId_type: {
            gameId,
            type,
          },
        },
        create: {
          gameId,
          type,
          quantity,
        },
        update: {
          quantity: {
            increment: quantity,
          },
        },
      });
    }

    if (outcome.discoveredZone) {
      await transaction.discoveredZone.create({
        data: {
          gameId,
          zone: outcome.discoveredZone,
        },
      });
    }

    if (outcome.discoveryMessage) {
      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'DISCOVERY',
          message: outcome.discoveryMessage,
        },
      });
    }

    if (narrativeEvent) {
      await persistNarrativeEvent(transaction, gameId, game.day, narrativeEvent);
    }

    if (antidoteEvent) {
      for (const [type, quantity] of Object.entries(antidoteEvent.resources)) {
        await applyPositiveResource(transaction, gameId, type as 'ANTIDOTE', quantity);
      }

      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'NARRATIVE',
          message: antidoteEvent.message,
        },
      });
    }

    if (decisionEvent) {
      await persistPendingDecisionEvent(transaction, gameId, game.day, decisionEvent);
    }

    const nextHealth = Math.max(0, game.health + (narrativeEvent?.healthDelta ?? 0));
    const isGameOver = nextHealth <= 0;

    const updatedGame = await transaction.game.update({
      where: {
        id: gameId,
      },
      data: {
        actionsRemaining: game.actionsRemaining - 1,
        hunger: clampStat(game.hunger + (changes.hunger ?? 0)),
        thirst: clampStat(game.thirst + (changes.thirst ?? 0)),
        energy: clampStat(game.energy + (changes.energy ?? 0)),
        sanity: applyNarrativeRegularStatDelta(
          clampStat(game.sanity + (changes.sanity ?? 0)),
          narrativeEvent?.sanityDelta,
        ),
        health: nextHealth,
        isGameOver,
        pendingDecisionEventKey: decisionEvent ?? game.pendingDecisionEventKey,
      },
      include: gameDetailsInclude,
    });

    const decisionMessage = decisionEvent ? decisionEvents[decisionEvent].message : null;
    const eventMessages = [decisionMessage, narrativeEvent?.message, antidoteEvent?.message].filter(Boolean) as string[];

    return {
      status: 'performed',
      game: updatedGame,
      message: [outcome.message, decisionMessage, narrativeEvent?.message, antidoteEvent?.message].filter(Boolean).join(' '),
      eventMessages: eventMessages.length > 0 ? eventMessages : undefined,
      importantEvent: decisionEvent
        ? { title: decisionEvents[decisionEvent].title, message: decisionEvents[decisionEvent].message }
        : toImportantEvent(narrativeEvent),
    };
  });
}

function toImportantEvent(event: NarrativeEventResult | null) {
  if (!event?.isSevere) {
    return undefined;
  }

  return {
    title: 'La isla se vuelve peligrosa',
    message: event.message,
  };
}

async function attemptRaftEnding(gameId: string, game: {
  day: number;
  health: number;
  energy: number;
  difficulty: string;
  actionsRemaining: number;
}) {
  const successChance = Math.min(0.85, 0.38 + game.health / 300 + game.energy / 400);
  const succeeds = Math.random() < successChance;
  const deadlyFailure = !succeeds && Math.random() < 0.22;
  const nextHealth = succeeds ? game.health : deadlyFailure ? 0 : Math.max(1, game.health - 35);
  const message = succeeds
    ? 'Has empujado la barca improvisada al mar y has logrado alcanzar tierra firme.'
    : deadlyFailure
      ? 'La barca se rompe mar adentro. No consigues volver a la isla.'
      : 'La barca no resiste el oleaje. Vuelves a la costa muy herido y sin fuerzas.';

  const updatedGame = await prisma.$transaction(async (transaction) => {
    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: succeeds ? 'VICTORY' : deadlyFailure ? 'GAME_OVER' : 'SURVIVAL',
        message,
      },
    });

    return transaction.game.update({
      where: { id: gameId },
      data: {
        actionsRemaining: 0,
        health: nextHealth,
        energy: succeeds ? game.energy : 0,
        isVictory: succeeds,
        isGameOver: deadlyFailure,
        endingType: succeeds ? 'RAFT_ESCAPE' : null,
        endingTitle: succeeds ? 'Barca improvisada' : null,
      },
      include: gameDetailsInclude,
    });
  });

  return {
    status: 'performed' as const,
    game: updatedGame,
    message,
    eventMessages: [message],
    importantEvent: {
      title: succeeds ? 'Has alcanzado tierra firme' : deadlyFailure ? 'La barca no resistió' : 'Intento fallido',
      message,
    },
  };
}

async function sendRadioSignal(gameId: string, game: {
  day: number;
  radioSignalDays: number;
  actionsRemaining: number;
  hunger: number;
  thirst: number;
  energy: number;
}) {
  const nextRadioSignalDays = game.radioSignalDays + 1;
  const isVictory = nextRadioSignalDays >= 3;
  const message = isVictory
    ? 'La radio responde con una voz entrecortada. Han localizado tu posición y llega el rescate.'
    : `Emites una señal de emergencia. Necesitas mantener la radio activa ${3 - nextRadioSignalDays} día(s) más.`;

  const updatedGame = await prisma.$transaction(async (transaction) => {
    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: isVictory ? 'VICTORY' : 'RESCUE',
        message,
      },
    });

    return transaction.game.update({
      where: { id: gameId },
      data: {
        actionsRemaining: game.actionsRemaining - 1,
        hunger: clampStat(game.hunger - 2),
        thirst: clampStat(game.thirst - 2),
        energy: clampStat(game.energy - 6),
        radioSignalDays: nextRadioSignalDays,
        isVictory,
        endingType: isVictory ? 'EMERGENCY_RADIO' : null,
        endingTitle: isVictory ? 'Radio de emergencia' : null,
      },
      include: gameDetailsInclude,
    });
  });

  return {
    status: 'performed' as const,
    game: updatedGame,
    message,
    eventMessages: [message],
    importantEvent: isVictory
      ? {
          title: 'Radio de emergencia',
          message,
        }
      : undefined,
  };
}
