import { prisma } from '../prisma/client.js';
import { gameDetailsInclude } from './game.service.js';
import {
  maybeRollNarrativeEvent,
  maybeRollDecisionEvent,
  persistNarrativeEvent,
  persistPendingDecisionEvent,
  applyNarrativeRegularStatDelta,
  decisionEvents,
} from './narrative-event.service.js';

type ConsumableResource = 'FOOD' | 'WATER';
type TransformAction = 'COOK_FISH' | 'FILTER_WATER';
type Weather = 'SUNNY' | 'CLOUDY' | 'RAIN' | 'STORM';
type StatKey = 'energy' | 'sanity';
type ResourceKey = 'WATER';
type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

interface NightEvent {
  type: 'CALM_NIGHT' | 'NIGHT_RAIN' | 'BAD_SLEEP' | 'STRANGE_NOISES';
  message: string;
  stats: Partial<Record<StatKey, number>>;
  resources: Partial<Record<ResourceKey, number>>;
}

export type SurvivalResult =
  | {
      status: 'updated';
      game: unknown;
      message: string;
      eventMessage?: string;
      eventMessages?: string[];
      importantEvent?: { title: string; message: string };
    }
  | { status: 'not_found' }
  | { status: 'game_over' }
  | { status: 'insufficient_resource' }
  | { status: 'missing_structure' };

const dailyDecay = {
  hunger: 5,
  thirst: 7,
  energy: 5,
};

const dailyDecayByDifficulty: Record<GameDifficulty, typeof dailyDecay> = {
  EASY: {
    hunger: 4,
    thirst: 5,
    energy: 4,
  },
  NORMAL: dailyDecay,
  HARD: {
    hunger: 7,
    thirst: 9,
    energy: 7,
  },
};

const healthPenaltyByDifficulty: Record<GameDifficulty, { hunger: number; thirst: number; sanity: number }> = {
  EASY: {
    hunger: 8,
    thirst: 12,
    sanity: 4,
  },
  NORMAL: {
    hunger: 10,
    thirst: 15,
    sanity: 5,
  },
  HARD: {
    hunger: 15,
    thirst: 20,
    sanity: 10,
  },
};

const weatherLabels: Record<Weather, string> = {
  SUNNY: 'soleado',
  CLOUDY: 'nublado',
  RAIN: 'con lluvia',
  STORM: 'con tormenta',
};

const rescueProgressByWeather: Record<Weather, number> = {
  SUNNY: 25,
  CLOUDY: 15,
  RAIN: 5,
  STORM: 0,
};

const endingTitles: Record<string, string> = {
  CLASSIC_RESCUE: 'Rescate clásico',
  SIGNAL_MIRROR_RESCUE: 'Espejo de señales',
  EMERGENCY_RADIO: 'Radio de emergencia',
  LEGENDARY_SURVIVOR: 'Superviviente legendario',
};

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampHealth(value: number, difficulty: GameDifficulty) {
  return Math.min(difficulty === 'EASY' ? 120 : 100, Math.max(0, value));
}

function rollNightEvent(): NightEvent {
  const roll = Math.random();

  if (roll < 0.4) {
    return {
      type: 'CALM_NIGHT',
      message: 'La noche ha sido tranquila.',
      stats: {},
      resources: {},
    };
  }

  if (roll < 0.65) {
    return {
      type: 'NIGHT_RAIN',
      message: 'Ha llovido durante la noche. Has conseguido algo de agua.',
      stats: {},
      resources: { WATER: 1 },
    };
  }

  if (roll < 0.85) {
    return {
      type: 'BAD_SLEEP',
      message: 'No has dormido bien. Te despiertas con menos energía.',
      stats: { energy: -10 },
      resources: {},
    };
  }

  return {
    type: 'STRANGE_NOISES',
    message: 'Has escuchado ruidos extraños durante la noche.',
    stats: { sanity: -10 },
    resources: {},
  };
}

function rollWeather(day: number): Weather {
  const roll = Math.random();

  if (day <= 4) {
    return roll < 0.55 ? 'SUNNY' : 'CLOUDY';
  }

  if (day <= 9) {
    if (roll < 0.45) {
      return 'SUNNY';
    }

    if (roll < 0.8) {
      return 'CLOUDY';
    }

    return 'RAIN';
  }

  if (roll < 0.35) {
    return 'SUNNY';
  }

  if (roll < 0.65) {
    return 'CLOUDY';
  }

  if (roll < 0.9) {
    return 'RAIN';
  }

  return 'STORM';
}

export async function consumeResource(
  gameId: string,
  resource: ConsumableResource,
): Promise<SurvivalResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: {
        id: gameId,
      },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    const item = game.inventoryItems.find((inventoryItem) => inventoryItem.type === resource);
    const hasCampfire = game.builtStructures.some((structure) => structure.type === 'CAMPFIRE');

    if (!item || item.quantity <= 0) {
      return { status: 'insufficient_resource' };
    }

    await transaction.inventoryItem.update({
      where: {
        gameId_type: {
          gameId,
          type: resource,
        },
      },
      data: {
        quantity: {
          decrement: 1,
        },
      },
    });

    const message =
      resource === 'FOOD'
        ? hasCampfire
          ? 'Has cocinado una ración junto a la fogata.'
          : 'Has consumido una ración de comida.'
        : 'Has bebido agua.';

    const updatedGame = await transaction.game.update({
      where: {
        id: gameId,
      },
      data:
        resource === 'FOOD'
          ? { hunger: clampStat(game.hunger + (hasCampfire ? 20 : 15)) }
          : { thirst: clampStat(game.thirst + 20) },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message,
    };
  });
}

export async function consumeSpecialResource(
  gameId: string,
  resource: 'COOKED_FISH' | 'COCONUT',
): Promise<SurvivalResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: {
        id: gameId,
      },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    const item = game.inventoryItems.find((inventoryItem) => inventoryItem.type === resource);

    if (!item || item.quantity <= 0) {
      return { status: 'insufficient_resource' };
    }

    await transaction.inventoryItem.update({
      where: {
        gameId_type: {
          gameId,
          type: resource,
        },
      },
      data: {
        quantity: {
          decrement: 1,
        },
      },
    });

    const updatedGame = await transaction.game.update({
      where: {
        id: gameId,
      },
      data:
        resource === 'COCONUT'
          ? {
              hunger: clampStat(game.hunger + 10),
              thirst: clampStat(game.thirst + 10),
            }
          : {
              hunger: clampStat(game.hunger + 25),
            },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message:
        resource === 'COCONUT'
          ? 'Has consumido un coco fresco.'
          : 'Has comido pescado cocinado.',
    };
  });
}

export async function transformResource(
  gameId: string,
  action: TransformAction,
): Promise<SurvivalResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: {
        id: gameId,
      },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    const hasCampfire = game.builtStructures.some((structure) => structure.type === 'CAMPFIRE');
    const hasWaterFilter = game.builtStructures.some((structure) => structure.type === 'WATER_FILTER');
    const recipe =
      action === 'COOK_FISH'
        ? {
            hasStructure: hasCampfire,
            input: 'RAW_FISH',
            output: 'COOKED_FISH',
            message: 'Has cocinado pescado junto a la fogata.',
          }
        : {
            hasStructure: hasWaterFilter,
            input: 'DIRTY_WATER',
            output: 'WATER',
            message: 'Has filtrado agua no potable.',
          };

    if (!recipe.hasStructure) {
      return { status: 'missing_structure' };
    }

    const inputItem = game.inventoryItems.find((inventoryItem) => inventoryItem.type === recipe.input);

    if (!inputItem || inputItem.quantity <= 0) {
      return { status: 'insufficient_resource' };
    }

    await transaction.inventoryItem.update({
      where: {
        gameId_type: {
          gameId,
          type: recipe.input,
        },
      },
      data: {
        quantity: {
          decrement: 1,
        },
      },
    });

    await transaction.inventoryItem.upsert({
      where: {
        gameId_type: {
          gameId,
          type: recipe.output,
        },
      },
      create: {
        gameId,
        type: recipe.output,
        quantity: 1,
      },
      update: {
        quantity: {
          increment: 1,
        },
      },
    });

    const updatedGame = await transaction.game.findUniqueOrThrow({
      where: {
        id: gameId,
      },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message: recipe.message,
    };
  });
}

export async function endDay(gameId: string): Promise<SurvivalResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      builtStructures: true,
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

  const builtTypes = new Set(game.builtStructures.map((structure) => structure.type));
  const difficulty = game.difficulty as GameDifficulty;
  const currentDailyDecay = dailyDecayByDifficulty[difficulty];
  const currentHealthPenalty = healthPenaltyByDifficulty[difficulty];
  const hasImprovedShelter = builtTypes.has('IMPROVED_SHELTER');
  const hasShelter = builtTypes.has('BASIC_SHELTER') || hasImprovedShelter;
  const hasWaterCollector = builtTypes.has('WATER_COLLECTOR');
  const hasLargeWaterCollector = builtTypes.has('LARGE_WATER_COLLECTOR');
  const hasSignalFire = builtTypes.has('SIGNAL_FIRE');
  const hasSignalMirror = builtTypes.has('SIGNAL_MIRROR');
  const hasRepairedRadio = builtTypes.has('REPAIRED_RADIO');
  const nightEvent = rollNightEvent();
  const decisionEvent = maybeRollDecisionEvent(game);
  const narrativeEvent = decisionEvent || game.pendingDecisionEventKey ? null : maybeRollNarrativeEvent(game, 'NIGHT');
  const nextDay = game.day + 1;
  const nextWeather = rollWeather(nextDay);
  const weatherMessages = [`El nuevo día amanece ${weatherLabels[nextWeather]}.`];
  const resourceChanges: Partial<Record<ResourceKey, number>> = { ...nightEvent.resources };

  let hunger = game.hunger - currentDailyDecay.hunger;
  let thirst = game.thirst - currentDailyDecay.thirst;
  let health = game.health;
  let energy = game.energy - currentDailyDecay.energy + (nightEvent.stats.energy ?? 0);
  let sanity = game.sanity + (nightEvent.stats.sanity ?? 0);
  let poisonDaysRemaining = game.poisonDaysRemaining;
  let poisonDamagePerDay = game.poisonDamagePerDay;
  const poisonMessages: string[] = [];

  if (poisonDaysRemaining > 0 && poisonDamagePerDay > 0) {
    health -= poisonDamagePerDay;
    poisonDaysRemaining -= 1;
    poisonMessages.push(
      poisonDaysRemaining > 0
        ? `El veneno te causa ${poisonDamagePerDay} de daño. Quedan ${poisonDaysRemaining} días.`
        : `El veneno te causa ${poisonDamagePerDay} de daño y abandona tu cuerpo.`,
    );

    if (poisonDaysRemaining <= 0) {
      poisonDamagePerDay = 0;
    }
  }

  if (hasImprovedShelter) {
    hunger += 1;
    thirst += 1;
    energy += 2;
    weatherMessages.push('Tu refugio mejorado te protege mejor durante la noche.');
  }

  if (nextWeather === 'SUNNY') {
    thirst -= 5;
    weatherMessages.push('El sol aprieta y necesitas más agua.');
  }

  if (nextWeather === 'RAIN') {
    resourceChanges.WATER = (resourceChanges.WATER ?? 0) + 1;
    weatherMessages.push('La lluvia ha llenado algunos recipientes.');

    if (hasWaterCollector) {
      resourceChanges.WATER += 2;
      weatherMessages.push('El recolector de agua ha guardado lluvia extra.');
    }

    if (hasLargeWaterCollector) {
      resourceChanges.WATER = (resourceChanges.WATER ?? 0) + 3;
      weatherMessages.push('El recolector grande ha almacenado más agua de lluvia.');
    }

    if (hasImprovedShelter) {
      weatherMessages.push('Tu refugio mejorado mantiene el ánimo durante la lluvia.');
    } else if (hasShelter) {
      weatherMessages.push('Tu refugio mantiene el ánimo estable durante la lluvia.');
    } else {
      sanity -= 5;
    }
  }

  if (nextWeather === 'STORM') {
    energy -= hasImprovedShelter ? 4 : 10;
    sanity -= hasImprovedShelter ? 2 : hasShelter ? 5 : 15;
    weatherMessages.push('La tormenta golpeó el campamento durante la noche.');

    if (hasImprovedShelter) {
      weatherMessages.push('Tu refugio mejorado resistió la tormenta.');
    } else if (hasShelter) {
      weatherMessages.push('Tu refugio te protegió de la tormenta.');
    } else {
      health -= 10;
    }
  }

  hunger = clampStat(hunger);
  thirst = clampStat(thirst);
  energy = clampStat(energy);
  sanity = applyNarrativeRegularStatDelta(clampStat(sanity), narrativeEvent?.sanityDelta);
  health = Math.max(0, clampHealth(health, difficulty) + (narrativeEvent?.healthDelta ?? 0));

  let healthPenalty = 0;

  if (hunger < 20) {
    healthPenalty += currentHealthPenalty.hunger;
  }

  if (thirst < 20) {
    healthPenalty += currentHealthPenalty.thirst;
  }

  if (sanity < 20) {
    healthPenalty += currentHealthPenalty.sanity;
  }

  const nextHealth = clampHealth(health - healthPenalty, difficulty);
  let rescueProgress = game.rescueProgress;
  let radioSignalDays = game.radioSignalDays;
  let endingType: string | null = null;
  let visualRescueSucceeded = false;

  if (hasSignalFire) {
    const mirrorBonus = hasSignalMirror && nextWeather === 'SUNNY' ? 35 : hasSignalMirror && nextWeather === 'CLOUDY' ? 18 : 0;
    const rescueGain = rescueProgressByWeather[nextWeather] + mirrorBonus;
    rescueProgress = clampStat(rescueProgress + rescueGain);

    if (rescueProgress >= 75 && rescueProgress < 100) {
      weatherMessages.push('Crees haber visto algo en el horizonte.');
    } else if (rescueGain === 0) {
      weatherMessages.push('La tormenta oculta tu señal de rescate.');
    }

    if (hasSignalMirror && mirrorBonus > 0) {
      weatherMessages.push('El espejo de señales lanza destellos visibles desde el mar.');
    }

    const rescueChance = Math.min(0.85, 0.08 + rescueProgress / 160 + (hasSignalMirror ? 0.25 : 0));
    visualRescueSucceeded = rescueProgress >= 100 || Math.random() < rescueChance;
  }

  if (hasRepairedRadio && radioSignalDays > 0) {
    radioSignalDays += 1;
    weatherMessages.push(
      radioSignalDays >= 3
        ? 'La radio recibe respuesta. Han localizado tu posición.'
        : `La radio sigue emitiendo. Quedan ${3 - radioSignalDays} día(s) para que puedan localizarte.`,
    );
  }

  if (radioSignalDays >= 3) {
    endingType = 'EMERGENCY_RADIO';
  } else if (nextDay >= 100) {
    endingType = 'LEGENDARY_SURVIVOR';
  } else if (visualRescueSucceeded) {
    endingType = hasSignalMirror ? 'SIGNAL_MIRROR_RESCUE' : 'CLASSIC_RESCUE';
  }

  const isVictory = !!endingType;
  const isGameOver = !isVictory && nextHealth <= 0;

  if (endingType === 'CLASSIC_RESCUE' || endingType === 'SIGNAL_MIRROR_RESCUE') {
    weatherMessages.push('Un barco ha visto tu señal. Has sido rescatado.');
  } else if (endingType === 'EMERGENCY_RADIO') {
    weatherMessages.push('El rescate llega siguiendo tu señal de radio.');
  } else if (endingType === 'LEGENDARY_SURVIVOR') {
    weatherMessages.push('Ya no esperas ser rescatado. La isla se ha convertido en tu hogar.');
  }

  const message = isVictory
    ? endingType === 'LEGENDARY_SURVIVOR'
      ? 'Ya no esperas ser rescatado. La isla se ha convertido en tu hogar.'
      : endingType === 'EMERGENCY_RADIO'
        ? 'El rescate ha llegado gracias a la radio de emergencia.'
        : 'Un barco ha visto tu señal. Has sido rescatado.'
    : isGameOver
      ? 'La supervivencia ha terminado.'
      : healthPenalty > 0
        ? 'Termina el día, pero tu cuerpo acusa el desgaste.'
        : 'Has terminado el día.';

  const updatedGame = await prisma.$transaction(async (transaction) => {
    for (const [type, quantity] of Object.entries(resourceChanges)) {
      if (quantity <= 0) {
        continue;
      }

      await transaction.inventoryItem.upsert({
        where: { gameId_type: { gameId, type } },
        create: { gameId, type, quantity },
        update: { quantity: { increment: quantity } },
      });
    }

    if (nightEvent.type !== 'CALM_NIGHT') {
      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'NIGHT_EVENT',
          message: nightEvent.message,
        },
      });
    }

    if (narrativeEvent) {
      await persistNarrativeEvent(transaction, gameId, game.day, narrativeEvent);
    }

    if (decisionEvent) {
      await persistPendingDecisionEvent(transaction, gameId, game.day, decisionEvent);
    }

    for (const poisonMessage of poisonMessages) {
      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'SURVIVAL',
          message: poisonMessage,
        },
      });
    }

    for (const weatherMessage of weatherMessages) {
      const type = weatherMessage.includes('horizonte') || weatherMessage.includes('rescate')
        ? 'RESCUE'
        : weatherMessage.includes('rescatado')
          ? 'VICTORY'
          : 'WEATHER';

      if (
        type === 'WEATHER' &&
        !weatherMessage.includes('tormenta') &&
        !weatherMessage.includes('Tormenta')
      ) {
        continue;
      }

      await transaction.eventLog.create({
        data: {
          gameId,
          day: nextDay,
          type,
          message: weatherMessage,
        },
      });
    }

    if (healthPenalty > 0) {
      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'SURVIVAL',
          message: 'Has perdido salud por hambre, sed o cordura baja.',
        },
      });
    }

    if (isGameOver) {
      await transaction.eventLog.create({
        data: {
          gameId,
          day: game.day,
          type: 'GAME_OVER',
          message: 'La supervivencia ha terminado.',
        },
      });
    }

    return transaction.game.update({
      where: { id: gameId },
      data: {
        day: nextDay,
        actionsRemaining: 2,
        health: nextHealth,
        hunger,
        thirst,
        energy,
        sanity,
        weather: nextWeather,
        rescueProgress,
        radioSignalDays,
        isGameOver,
        isVictory,
        endingType,
        endingTitle: endingType ? endingTitles[endingType] : null,
        pendingDecisionEventKey: decisionEvent ?? game.pendingDecisionEventKey,
        poisonDaysRemaining,
        poisonDamagePerDay,
      },
      include: gameDetailsInclude,
    });
  });

  const decisionMessage = decisionEvent ? decisionEvents[decisionEvent].message : null;
  const eventMessages = [
    nightEvent.message,
    ...poisonMessages,
    ...(decisionMessage ? [decisionMessage] : []),
    ...(narrativeEvent ? [narrativeEvent.message] : []),
    ...weatherMessages,
  ];

  return {
    status: 'updated',
    game: updatedGame,
    message: [message, decisionMessage, narrativeEvent?.message].filter(Boolean).join(' '),
    eventMessage: eventMessages.join(' '),
    eventMessages,
    importantEvent: decisionEvent
      ? {
          title: decisionEvents[decisionEvent].title,
          message: decisionEvents[decisionEvent].message,
        }
      : narrativeEvent?.isSevere
      ? {
          title: 'La noche se complica',
          message: narrativeEvent.message,
        }
      : undefined,
  };
}
