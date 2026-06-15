import { prisma } from '../prisma/client.js';

export const resourceTypes = [
  'FOOD',
  'WATER',
  'WOOD',
  'STONE',
  'FIBER',
  'RAW_FISH',
  'COOKED_FISH',
  'COCONUT',
  'DIRTY_WATER',
  'ANTIDOTE',
  'FIRST_AID_KIT',
  'BROKEN_RADIO',
  'RADIO_PARTS',
] as const;
export const gameDifficulties = ['EASY', 'NORMAL', 'HARD'] as const;

export type GameDifficulty = (typeof gameDifficulties)[number];

export const gameDetailsInclude = {
  inventoryItems: {
    orderBy: {
      type: 'asc' as const,
    },
  },
  builtStructures: {
    orderBy: {
      type: 'asc' as const,
    },
  },
  discoveredZones: {
    orderBy: {
      discoveredAt: 'asc' as const,
    },
  },
  eventLogs: {
    orderBy: [
      {
        day: 'desc' as const,
      },
      {
        createdAt: 'desc' as const,
      },
    ],
  },
  narrativeEvents: {
    orderBy: {
      occurredAt: 'asc' as const,
    },
  },
};

const difficultyLabels: Record<GameDifficulty, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
};

const initialGameStateByDifficulty: Record<GameDifficulty, {
  health: number;
  hunger: number;
  thirst: number;
  energy: number;
  sanity: number;
  actionsRemaining: number;
}> = {
  EASY: {
    health: 120,
    hunger: 90,
    thirst: 90,
    energy: 100,
    sanity: 100,
    actionsRemaining: 3,
  },
  NORMAL: {
    health: 100,
    hunger: 80,
    thirst: 80,
    energy: 100,
    sanity: 100,
    actionsRemaining: 2,
  },
  HARD: {
    health: 80,
    hunger: 65,
    thirst: 65,
    energy: 85,
    sanity: 90,
    actionsRemaining: 2,
  },
};

export function isGameDifficulty(difficulty: unknown): difficulty is GameDifficulty {
  return typeof difficulty === 'string' && gameDifficulties.includes(difficulty as GameDifficulty);
}

export function createGame(difficulty: GameDifficulty = 'NORMAL') {
  const initialGameState = initialGameStateByDifficulty[difficulty];

  return prisma.game.create({
    data: {
      ...initialGameState,
      day: 1,
      weather: 'SUNNY',
      difficulty,
      rescueProgress: 0,
      isGameOver: false,
      isVictory: false,
      inventoryItems: {
        create: resourceTypes.map((type) => ({
          type,
          quantity: 0,
        })),
      },
      discoveredZones: {
        create: {
          zone: 'BEACH',
        },
      },
      eventLogs: {
        create: {
          day: 1,
          type: 'SURVIVAL',
          message: `Partida iniciada en dificultad ${difficultyLabels[difficulty]}.`,
        },
      },
    },
    include: gameDetailsInclude,
  });
}

export function getGames() {
  return prisma.game.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export function getGameById(id: string) {
  return prisma.game.findUnique({
    where: {
      id,
    },
    include: gameDetailsInclude,
  });
}
