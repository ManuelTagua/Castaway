import { Prisma } from '@prisma/client';

export type DecisionEventKey =
  | 'DECISION_ABANDONED_BACKPACK'
  | 'DECISION_STRANGE_FOOTPRINTS'
  | 'DECISION_WILD_BOAR'
  | 'DECISION_SEA_CRATE'
  | 'DECISION_SEA_CANISTER'
  | 'DECISION_STRANGE_FRUIT_TREE'
  | 'DECISION_INJURED_ANIMAL'
  | 'DECISION_DISTANT_SMOKE'
  | 'DECISION_SHIPWRECK_DEBRIS';

export type NarrativeEventKey =
  | 'MONKEY_STEALS_FOOD'
  | 'STRANGE_NIGHT_NOISES'
  | 'WILD_BOAR'
  | 'ABANDONED_BACKPACK'
  | 'STRANGE_FOOTPRINTS'
  | 'COCONUT_FALL'
  | DecisionEventKey;

export type DecisionChoice =
  | 'OPEN'
  | 'IGNORE'
  | 'FOLLOW'
  | 'SCARE'
  | 'HIDE'
  | 'LEAVE'
  | 'EAT'
  | 'KEEP'
  | 'HELP'
  | 'INVESTIGATE'
  | 'STAY'
  | 'SEARCH';
export type NarrativeTrigger = 'NIGHT' | 'EXPLORE' | 'FORAGE';
export type ResourceType =
  | 'FOOD'
  | 'WATER'
  | 'WOOD'
  | 'STONE'
  | 'COCONUT'
  | 'FIBER'
  | 'ANTIDOTE'
  | 'FIRST_AID_KIT'
  | 'BROKEN_RADIO'
  | 'RADIO_PARTS';

export interface NarrativeInventoryItem {
  type: string;
  quantity: number;
}

export interface NarrativeGameState {
  id: string;
  day: number;
  health: number;
  energy?: number;
  sanity: number;
  pendingDecisionEventKey?: string | null;
  inventoryItems: NarrativeInventoryItem[];
  narrativeEvents: Array<{
    eventKey: string;
    day: number;
  }>;
}

export interface NarrativeEventResult {
  key: NarrativeEventKey;
  message: string;
  isSevere: boolean;
  healthDelta?: number;
  sanityDelta?: number;
  resources: Partial<Record<ResourceType, number>>;
}

type NarrativeTransaction = Pick<
  Prisma.TransactionClient,
  'inventoryItem' | 'narrativeEvent' | 'eventLog' | 'game' | 'discoveredZone'
>;

const eventMessages: Record<NarrativeEventKey, string> = {
  MONKEY_STEALS_FOOD: 'Un mono ha entrado en el campamento y ha robado parte de tu comida.',
  STRANGE_NIGHT_NOISES: 'Has escuchado ruidos extraños cerca del campamento durante la noche.',
  WILD_BOAR: 'Un jabalí se acercó al campamento. Lograste espantarlo, pero saliste herido.',
  ABANDONED_BACKPACK: 'Has encontrado una mochila abandonada con algunos suministros.',
  STRANGE_FOOTPRINTS: 'Seguiste unas huellas extrañas y encontraste restos de comida útil.',
  COCONUT_FALL: 'Has conseguido un coco, pero te has hecho daño al caer.',
  DECISION_ABANDONED_BACKPACK: 'Encuentras una mochila abandonada.',
  DECISION_STRANGE_FOOTPRINTS: 'Ves huellas extrañas cerca del campamento.',
  DECISION_WILD_BOAR: 'Un jabalí merodea cerca del campamento.',
  DECISION_SEA_CRATE: 'Una caja ha sido arrastrada por el mar hasta la playa.',
  DECISION_SEA_CANISTER: 'Un bote cerrado ha sido arrastrado por el mar.',
  DECISION_STRANGE_FRUIT_TREE: 'Encuentras un Árbol frutal extraño.',
  DECISION_INJURED_ANIMAL: 'Un animal herido aparece cerca del refugio.',
  DECISION_DISTANT_SMOKE: 'Ves una columna de humo en la distancia.',
  DECISION_SHIPWRECK_DEBRIS: 'Restos de barco aparecen entre las rocas.',
};

export const decisionEvents: Record<DecisionEventKey, {
  title: string;
  message: string;
  choices: Array<{ key: DecisionChoice; label: string }>;
}> = {
  DECISION_ABANDONED_BACKPACK: {
    title: 'Mochila abandonada',
    message: 'Encuentras una mochila abandonada medio enterrada. Podría tener suministros... o algo peor.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_STRANGE_FOOTPRINTS: {
    title: 'Huellas extrañas',
    message: 'Un rastro de huellas se aleja entre la vegetación.',
    choices: [
      { key: 'FOLLOW', label: 'Seguirlas' },
      { key: 'IGNORE', label: 'Ignorarlas' },
    ],
  },
  DECISION_WILD_BOAR: {
    title: 'Jabalí cerca del campamento',
    message: 'Un jabalí se acerca demasiado a tus provisiones.',
    choices: [
      { key: 'SCARE', label: 'Espantar' },
      { key: 'HIDE', label: 'Esconderse' },
    ],
  },
  DECISION_SEA_CRATE: {
    title: 'Caja arrastrada por el mar',
    message: 'Una caja golpeada por las olas queda varada en la arena.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'LEAVE', label: 'Dejarla' },
    ],
  },
  DECISION_SEA_CANISTER: {
    title: 'Bote arrastrado por el mar',
    message: 'Un bote metálico cerrado aparece entre restos de marea.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_STRANGE_FRUIT_TREE: {
    title: 'Árbol frutal extraño',
    message: 'El Árbol tiene frutos brillantes que no reconoces.',
    choices: [
      { key: 'EAT', label: 'Comer' },
      { key: 'KEEP', label: 'Guardar' },
    ],
  },
  DECISION_INJURED_ANIMAL: {
    title: 'Animal herido',
    message: 'Un animal pequeño tiembla junto a unas rocas. Podrías ayudarlo, pero costará recursos.',
    choices: [
      { key: 'HELP', label: 'Ayudar' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_DISTANT_SMOKE: {
    title: 'Humo en la distancia',
    message: 'Una columna de humo se eleva lejos del campamento.',
    choices: [
      { key: 'INVESTIGATE', label: 'Investigar' },
      { key: 'STAY', label: 'Quedarse' },
    ],
  },
  DECISION_SHIPWRECK_DEBRIS: {
    title: 'Restos de barco',
    message: 'Encuentras tablones rotos y cajas atrapadas entre las rocas.',
    choices: [
      { key: 'SEARCH', label: 'Registrar' },
      { key: 'LEAVE', label: 'Marcharse' },
    ],
  },
};

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

function rollChance(chance: number) {
  return Math.random() < chance;
}

function rollBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function inventoryQuantity(game: NarrativeGameState, type: ResourceType) {
  return game.inventoryItems.find((item) => item.type === type)?.quantity ?? 0;
}

function availableFoodTypes(game: NarrativeGameState) {
  return (['FOOD', 'COCONUT'] as const).filter((type) => inventoryQuantity(game, type) > 0);
}

function hasNarrativeEventToday(game: NarrativeGameState) {
  return game.narrativeEvents.some((event) => event.day === game.day);
}

function hasOccurred(game: NarrativeGameState, key: NarrativeEventKey) {
  return game.narrativeEvents.some((event) => event.eventKey === key);
}

function hasAntidote(game: NarrativeGameState) {
  return inventoryQuantity(game, 'ANTIDOTE') > 0;
}

function hasFirstAidKit(game: NarrativeGameState) {
  return inventoryQuantity(game, 'FIRST_AID_KIT') > 0;
}

function eligibleEvents(
  game: NarrativeGameState,
  trigger: NarrativeTrigger,
  exploreZone: string | null = null,
): NarrativeEventKey[] {
  const candidates: NarrativeEventKey[] = [];

  if (trigger === 'NIGHT') {
    if (availableFoodTypes(game).length > 0) {
      candidates.push('MONKEY_STEALS_FOOD');
    }

    candidates.push('STRANGE_NIGHT_NOISES', 'WILD_BOAR');
  }

  if (trigger === 'EXPLORE') {
    candidates.push('ABANDONED_BACKPACK', 'STRANGE_FOOTPRINTS');

    if (exploreZone === 'BEACH') {
      candidates.push('COCONUT_FALL');
    }
  }

  if (trigger === 'FORAGE') {
    candidates.push('COCONUT_FALL');
  }

  return candidates.filter((key) => !hasOccurred(game, key));
}

function rollNarrativeOutcome(
  game: NarrativeGameState,
  key: NarrativeEventKey,
): NarrativeEventResult | null {
  if (key === 'MONKEY_STEALS_FOOD') {
    const foodTypes = availableFoodTypes(game);
    const type = foodTypes[Math.floor(Math.random() * foodTypes.length)];

    if (!type) {
      return null;
    }

    const quantity = Math.min(rollBetween(1, 3), inventoryQuantity(game, type));

    if (quantity <= 0) {
      return null;
    }

    return { key, message: eventMessages[key], isSevere: false, resources: { [type]: -quantity } };
  }

  if (key === 'STRANGE_NIGHT_NOISES') {
    return { key, message: eventMessages[key], isSevere: false, sanityDelta: -8, resources: {} };
  }

  if (key === 'WILD_BOAR') {
    return {
      key,
      message: eventMessages[key],
      isSevere: true,
      healthDelta: -10,
      resources: inventoryQuantity(game, 'FOOD') > 0 ? { FOOD: -1 } : {},
    };
  }

  if (key === 'ABANDONED_BACKPACK') {
    if (Math.random() < 0.5) {
      return {
        key,
        message: eventMessages[key],
        isSevere: false,
        resources: { FIBER: 2, FOOD: 1 },
      };
    }

    return {
      key,
      message: 'Al abrir una mochila abandonada, una serpiente escondida te mordio. Pierdes 10 salud inmediatamente.',
      isSevere: true,
      healthDelta: -10,
      resources: {},
    };
  }

  if (key === 'STRANGE_FOOTPRINTS') {
    if (Math.random() < 0.5) {
      return { key, message: eventMessages[key], isSevere: false, resources: { FOOD: 2 } };
    }

    return {
      key,
      message: 'Seguiste unas huellas extrañas, pero no encontraste nada. La incertidumbre te inquieta.',
      isSevere: false,
      sanityDelta: -5,
      resources: {},
    };
  }

  return {
    key,
    message: eventMessages.COCONUT_FALL,
    isSevere: true,
    healthDelta: -8,
    resources: { COCONUT: 1 },
  };
}

export function maybeRollNarrativeEvent(
  game: NarrativeGameState,
  trigger: NarrativeTrigger,
  exploreZone: string | null = null,
): NarrativeEventResult | null {
  if (hasNarrativeEventToday(game)) {
    return null;
  }

  const chance = trigger === 'NIGHT' ? 0.12 : 0.15;

  if (!rollChance(chance)) {
    return null;
  }

  const events = eligibleEvents(game, trigger, exploreZone);

  if (events.length === 0) {
    return null;
  }

  const key = events[Math.floor(Math.random() * events.length)];

  return rollNarrativeOutcome(game, key);
}

export function maybeRollDecisionEvent(
  game: NarrativeGameState,
  exploreZone: string | null = null,
): DecisionEventKey | null {
  if (game.pendingDecisionEventKey || hasNarrativeEventToday(game) || !rollChance(0.08)) {
    return null;
  }

  const zoneCandidates: Partial<Record<string, DecisionEventKey[]>> = {
    BEACH: ['DECISION_SEA_CRATE', 'DECISION_SEA_CANISTER', 'DECISION_SHIPWRECK_DEBRIS'],
    JUNGLE: [
      'DECISION_ABANDONED_BACKPACK',
      'DECISION_STRANGE_FOOTPRINTS',
      'DECISION_STRANGE_FRUIT_TREE',
      'DECISION_INJURED_ANIMAL',
    ],
    CAVE: ['DECISION_ABANDONED_BACKPACK', 'DECISION_SHIPWRECK_DEBRIS', 'DECISION_STRANGE_FOOTPRINTS'],
    CLIFFS: ['DECISION_DISTANT_SMOKE', 'DECISION_SHIPWRECK_DEBRIS', 'DECISION_SEA_CRATE'],
  };

  const pool = exploreZone ? zoneCandidates[exploreZone] ?? [] : (Object.keys(decisionEvents) as DecisionEventKey[]);
  const candidates = pool.filter((key) => !hasOccurred(game, key));

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function persistPendingDecisionEvent(
  transaction: NarrativeTransaction,
  gameId: string,
  day: number,
  key: DecisionEventKey,
) {
  await transaction.narrativeEvent.create({ data: { gameId, eventKey: key, day } });
  await transaction.eventLog.create({
    data: { gameId, day, type: 'NARRATIVE', message: eventMessages[key] },
  });
}

export async function applyPositiveResource(
  transaction: NarrativeTransaction,
  gameId: string,
  type: ResourceType,
  quantity: number,
) {
  if (quantity <= 0) return;

  if (type === 'ANTIDOTE' || type === 'FIRST_AID_KIT' || type === 'BROKEN_RADIO') {
    await transaction.inventoryItem.upsert({
      where: { gameId_type: { gameId, type } },
      create: { gameId, type, quantity: 1 },
      update: { quantity: 1 },
    });
    return;
  }

  await transaction.inventoryItem.upsert({
    where: { gameId_type: { gameId, type } },
    create: { gameId, type, quantity },
    update: { quantity: { increment: quantity } },
  });
}

export async function persistNarrativeEvent(
  transaction: NarrativeTransaction,
  gameId: string,
  day: number,
  event: NarrativeEventResult,
) {
  for (const [type, quantity] of Object.entries(event.resources)) {
    if (quantity > 0) {
      await applyPositiveResource(transaction, gameId, type as ResourceType, quantity);
      continue;
    }

    if (quantity < 0) {
      await transaction.inventoryItem.update({
        where: { gameId_type: { gameId, type } },
        data: { quantity: { decrement: Math.abs(quantity) } },
      });
    }
  }

  await transaction.narrativeEvent.create({ data: { gameId, eventKey: event.key, day } });
  await transaction.eventLog.create({
    data: { gameId, day, type: 'NARRATIVE', message: event.message },
  });
}

export function rollExplorationAntidote(game: NarrativeGameState): NarrativeEventResult | null {
  if (hasAntidote(game) || !rollChance(0.08)) {
    return null;
  }

  return {
    key: 'COCONUT_FALL',
    message: 'Has encontrado una cura natural contra el veneno.',
    isSevere: false,
    resources: { ANTIDOTE: 1 },
  };
}

export function resolveDecisionOutcome(
  eventKey: DecisionEventKey,
  choice: DecisionChoice,
  game: NarrativeGameState,
): {
  message: string;
  healthDelta?: number;
  energyDelta?: number;
  resources?: Partial<Record<ResourceType, number>>;
  poison?: { days: number; damage: number };
  discoverZone?: 'JUNGLE' | 'CAVE' | 'CLIFFS';
} {
  if (choice === 'IGNORE' || choice === 'LEAVE') {
    return { message: 'Decides no arriesgarte. No ganas ni pierdes recursos.' };
  }

  if (eventKey === 'DECISION_ABANDONED_BACKPACK') {
    const outcomes = ['FOOD', 'WATER', 'MATERIALS', 'TOOL', 'NOTHING', 'SNAKE'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (outcome === 'FOOD') return { message: 'La mochila tenía comida aprovechable. Ganas 2 comida.', resources: { FOOD: 2 } };
    if (outcome === 'WATER') return { message: 'La mochila guardaba una cantimplora con agua. Ganas 2 agua.', resources: { WATER: 2 } };
    if (outcome === 'MATERIALS') return { message: 'Encuentras materiales útiles dentro de la mochila. Ganas 2 madera y 2 fibra.', resources: { WOOD: 2, FIBER: 2 } };
    if (outcome === 'TOOL') {
      if (!hasFirstAidKit(game)) {
        return { message: 'Encuentras un botiquín sellado. Ganas 1 botiquín.', resources: { FIRST_AID_KIT: 1 } };
      }

      return hasAntidote(game)
        ? { message: 'Encuentras vendas y fibra útil. Ganas 2 fibra.', resources: { FIBER: 2 } }
        : { message: 'Encuentras una cura natural bien envuelta. Ganas 1 cura.', resources: { ANTIDOTE: 1 } };
    }
    if (outcome === 'SNAKE') {
      return {
        message: 'Una serpiente escondida te muerde. Has quedado envenenado: perderás 6 de salud al finalizar cada día durante 3 días, salvo que uses una cura o un botiquín.',
        healthDelta: -6,
        poison: { days: 3, damage: 6 },
      };
    }

    return { message: 'La mochila estaba vacía.' };
  }

  if (eventKey === 'DECISION_STRANGE_FOOTPRINTS') {
    const outcomes = ['RESOURCES', 'ZONE', 'ENERGY', 'INJURY'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (outcome === 'RESOURCES') return { message: 'Las huellas te llevan hasta recursos escondidos. Ganas 1 comida y 1 agua.', resources: { FOOD: 1, WATER: 1 } };
    if (outcome === 'ZONE') return { message: 'Las huellas revelan una ruta hacia la jungla. Nueva zona descubierta si aún no la conocías.', discoverZone: 'JUNGLE' };
    if (outcome === 'ENERGY') return { message: 'Sigues el rastro durante horas y acabas agotado. Pierdes 18 energía.', energyDelta: -18 };
    return { message: 'El terreno cede bajo tus pies y te lesionas. Pierdes 10 salud.', healthDelta: -10 };
  }

  if (eventKey === 'DECISION_WILD_BOAR') {
    if (choice === 'SCARE') {
      return Math.random() < 0.55
        ? { message: 'Espantas al jabalí antes de que llegue a tus provisiones. Pierdes 8 energía.', energyDelta: -8 }
        : { message: 'El jabalí carga contra ti antes de huir. Pierdes 12 salud.', healthDelta: -12 };
    }

    return inventoryQuantity(game, 'FOOD') > 0
      ? { message: 'Te escondes. El jabalí se marcha con parte de tu comida. Pierdes 1 comida.', resources: { FOOD: -1 } }
      : { message: 'Te escondes hasta que el jabalí se aleja.' };
  }

  if (eventKey === 'DECISION_SEA_CANISTER') {
    const outcomes = ['WATER', 'FOOD', 'TOOL', 'RADIO_PARTS', 'NOTHING'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (outcome === 'WATER') return { message: 'El bote contiene agua protegida de la sal. Ganas 3 agua.', resources: { WATER: 3 } };
    if (outcome === 'FOOD') return { message: 'El bote contiene raciones secas. Ganas 2 comida.', resources: { FOOD: 2 } };
    if (outcome === 'RADIO_PARTS') return { message: 'El bote contiene componentes eléctricos secos. Ganas 1 pieza de radio.', resources: { RADIO_PARTS: 1 } };
    if (outcome === 'TOOL') {
      return hasFirstAidKit(game)
        ? { message: 'El bote trae fibra seca y vendas sueltas. Ganas 2 fibra.', resources: { FIBER: 2 } }
        : { message: 'El bote trae un botiquín compacto. Ganas 1 botiquín.', resources: { FIRST_AID_KIT: 1 } };
    }
    return { message: 'El bote estaba vacio. No hay consecuencias.' };
  }

  if (eventKey === 'DECISION_STRANGE_FRUIT_TREE') {
    if (choice === 'KEEP') {
      return Math.random() < 0.65
        ? { message: 'Guardas frutos comestibles con cuidado. Ganas 2 comida.', resources: { FOOD: 2 } }
        : {
            message: hasAntidote(game)
              ? 'Entre las ramas encuentras fibra medicinal. Ya tienes una cura, así que ganas 1 fibra.'
              : 'Entre las ramas encuentras una resina útil contra mordeduras. Ganas 1 cura.',
            resources: hasAntidote(game) ? { FIBER: 1 } : { ANTIDOTE: 1 },
          };
    }

    const outcomes = ['FOOD', 'SICKNESS', 'RARE'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (outcome === 'FOOD') return { message: 'Los frutos eran nutritivos. Ganas 3 comida.', resources: { FOOD: 3 } };
    if (outcome === 'RARE') return { message: 'Bajo el Árbol encuentras fibras muy resistentes. Ganas 3 fibra.', resources: { FIBER: 3 } };
    return { message: 'Los frutos te sientan mal. Pierdes 10 salud.', healthDelta: -10 };
  }

  if (eventKey === 'DECISION_INJURED_ANIMAL') {
    if (choice !== 'HELP') {
      return { message: 'Ignoras al animal y conservas tus recursos. No hay consecuencias inmediatas.' };
    }

    const outcomes = ['REWARD', 'NOTHING', 'LOSS'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (outcome === 'REWARD') return { message: 'Ayudas al animal y más tarde vuelve con comida. Ganas 2 comida.', resources: { FOOD: 2 } };
    if (outcome === 'LOSS' && inventoryQuantity(game, 'FOOD') > 0) return { message: 'Intentas ayudarlo, pero huye llevandose comida. Pierdes 1 comida.', resources: { FOOD: -1 } };
    return { message: 'Ayudas al animal, pero no ocurre nada más. No ganas ni pierdes recursos.' };
  }

  if (eventKey === 'DECISION_DISTANT_SMOKE') {
    if (choice !== 'INVESTIGATE') {
      return { message: 'Decides quedarte en el campamento. No arriesgas energía ni salud.' };
    }

    const outcomes = ['MATERIALS', 'ZONE', 'DANGER'] as const;
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (outcome === 'MATERIALS') return { message: 'El humo venía de una fogata abandonada. Ganas 2 madera y 1 piedra. Pierdes 10 energía por el viaje.', energyDelta: -10, resources: { WOOD: 2, STONE: 1 } };
    if (outcome === 'ZONE') return { message: 'La ruta hacia el humo revela los acantilados. Nueva zona descubierta si aún no la conocías. Pierdes 12 energía.', energyDelta: -12, discoverZone: 'CLIFFS' };
    return { message: 'El humo atraía peligro. Escapas herido y agotado: pierdes 10 salud y 12 energía.', healthDelta: -10, energyDelta: -12 };
  }

  if (eventKey === 'DECISION_SHIPWRECK_DEBRIS' && choice !== 'SEARCH') {
    return { message: 'Te alejas de los restos del barco. No arriesgas salud ni energía.' };
  }

  const crateOutcomes = eventKey === 'DECISION_SHIPWRECK_DEBRIS'
    ? (['FOOD', 'WATER', 'MATERIALS', 'RADIO', 'RADIO_PARTS', 'NOTHING', 'INJURY'] as const)
    : (['FOOD', 'WATER', 'MATERIALS', 'RADIO_PARTS', 'NOTHING', 'INJURY'] as const);
  const crateOutcome = crateOutcomes[Math.floor(Math.random() * crateOutcomes.length)];
  if (crateOutcome === 'FOOD') return { message: 'Encuentras comida en buen estado. Ganas 2 comida.', resources: { FOOD: 2 } };
  if (crateOutcome === 'WATER') return { message: 'Encuentras botellas de agua cerradas. Ganas 2 agua.', resources: { WATER: 2 } };
  if (crateOutcome === 'MATERIALS') return { message: 'Recuperas madera, piedra y fibra. Ganas 2 madera, 1 piedra y 1 fibra.', resources: { WOOD: 2, STONE: 1, FIBER: 1 } };
  if (crateOutcome === 'RADIO') return { message: 'Entre los restos encuentras una radio rota. Ganas 1 radio rota: no funciona hasta repararla con piezas.', resources: { BROKEN_RADIO: 1 } };
  if (crateOutcome === 'RADIO_PARTS') return { message: 'Encuentras componentes útiles para una radio. Ganas 1 pieza de radio.', resources: { RADIO_PARTS: 1 } };
  if (crateOutcome === 'INJURY') return { message: 'Al registrar los restos, una tabla rota te corta. Pierdes 8 salud.', healthDelta: -8 };
  return { message: 'No encuentras nada útil. No hay consecuencias.' };
}

export function applyNarrativeStatDelta(value: number, delta: number | undefined, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value + (delta ?? 0)));
}

export function applyNarrativeRegularStatDelta(value: number, delta: number | undefined) {
  return clampStat(value + (delta ?? 0));
}
