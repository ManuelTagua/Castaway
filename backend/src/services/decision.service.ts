import { prisma } from '../prisma/client.js';
import { gameDetailsInclude } from './game.service.js';
import {
  applyPositiveResource,
  DecisionChoice,
  decisionEvents,
  DecisionEventKey,
  resolveDecisionOutcome,
  ResourceType,
} from './narrative-event.service.js';

export type DecisionResult =
  | {
      status: 'updated';
      game: unknown;
      message: string;
      eventMessages: string[];
      importantEvent?: { title: string; message: string };
    }
  | { status: 'not_found' }
  | { status: 'game_over' }
  | { status: 'no_pending_decision' }
  | { status: 'invalid_choice' }
  | { status: 'insufficient_resource' };

type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';

function clampStat(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampHealth(value: number, difficulty: GameDifficulty) {
  return Math.min(difficulty === 'EASY' ? 120 : 100, Math.max(0, value));
}

function isDecisionEventKey(key: string | null | undefined): key is DecisionEventKey {
  return !!key && key in decisionEvents;
}

function isValidChoice(eventKey: DecisionEventKey, choice: DecisionChoice) {
  return decisionEvents[eventKey].choices.some((eventChoice) => eventChoice.key === choice);
}

export function isDecisionChoice(choice: unknown): choice is DecisionChoice {
  return (
    choice === 'OPEN' ||
    choice === 'IGNORE' ||
    choice === 'FOLLOW' ||
    choice === 'SCARE' ||
    choice === 'HIDE' ||
    choice === 'LEAVE' ||
    choice === 'EAT' ||
    choice === 'KEEP' ||
    choice === 'HELP' ||
    choice === 'INVESTIGATE' ||
    choice === 'STAY' ||
    choice === 'SEARCH'
  );
}

export async function resolveDecision(gameId: string, choice: DecisionChoice): Promise<DecisionResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: { id: gameId },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    if (!isDecisionEventKey(game.pendingDecisionEventKey)) {
      return { status: 'no_pending_decision' };
    }

    if (!isValidChoice(game.pendingDecisionEventKey, choice)) {
      return { status: 'invalid_choice' };
    }

    const outcome = resolveDecisionOutcome(game.pendingDecisionEventKey, choice, game);

    for (const [type, quantity] of Object.entries(outcome.resources ?? {})) {
      if (quantity > 0) {
        await applyPositiveResource(transaction, gameId, type as ResourceType, quantity);
        continue;
      }

      if (quantity < 0) {
        const current = game.inventoryItems.find((item) => item.type === type)?.quantity ?? 0;
        await transaction.inventoryItem.upsert({
          where: { gameId_type: { gameId, type } },
          create: { gameId, type, quantity: 0 },
          update: { quantity: Math.max(0, current + quantity) },
        });
      }
    }

    if (outcome.discoverZone) {
      await transaction.discoveredZone.upsert({
        where: {
          gameId_zone: {
            gameId,
            zone: outcome.discoverZone,
          },
        },
        create: {
          gameId,
          zone: outcome.discoverZone,
        },
        update: {},
      });
    }

    const difficulty = game.difficulty as GameDifficulty;
    const nextHealth = clampHealth(game.health + (outcome.healthDelta ?? 0), difficulty);
    const isGameOver = nextHealth <= 0;

    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: isGameOver ? 'GAME_OVER' : 'NARRATIVE',
        message: outcome.message,
      },
    });

    const updatedGame = await transaction.game.update({
      where: { id: gameId },
      data: {
        health: nextHealth,
        energy: clampStat(game.energy + (outcome.energyDelta ?? 0)),
        pendingDecisionEventKey: null,
        poisonDaysRemaining: outcome.poison?.days ?? game.poisonDaysRemaining,
        poisonDamagePerDay: outcome.poison?.damage ?? game.poisonDamagePerDay,
        isGameOver,
      },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message: outcome.message,
      eventMessages: [outcome.message],
      importantEvent:
        outcome.poison || isGameOver || (outcome.healthDelta ?? 0) < 0
          ? {
              title: outcome.poison ? 'Has sido envenenado' : 'La isla pasa factura',
              message: outcome.message,
            }
          : undefined,
    };
  });
}

export async function useAntidote(gameId: string): Promise<DecisionResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: { id: gameId },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    const antidote = game.inventoryItems.find((item) => item.type === 'ANTIDOTE');

    if (!antidote || antidote.quantity <= 0) {
      return { status: 'insufficient_resource' };
    }

    if (game.poisonDaysRemaining <= 0) {
      return {
        status: 'updated',
        game,
        message: 'No necesitas usar la cura ahora.',
        eventMessages: ['No necesitas usar la cura ahora.'],
      };
    }

    await transaction.inventoryItem.update({
      where: {
        gameId_type: {
          gameId,
          type: 'ANTIDOTE',
        },
      },
      data: {
        quantity: {
          decrement: 1,
        },
      },
    });

    const message = 'Usas la cura y eliminas el veneno.';

    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: 'SURVIVAL',
        message,
      },
    });

    const updatedGame = await transaction.game.update({
      where: { id: gameId },
      data: {
        poisonDaysRemaining: 0,
        poisonDamagePerDay: 0,
      },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message,
      eventMessages: [message],
    };
  });
}

export async function useFirstAidKit(gameId: string): Promise<DecisionResult> {
  return prisma.$transaction(async (transaction) => {
    const game = await transaction.game.findUnique({
      where: { id: gameId },
      include: gameDetailsInclude,
    });

    if (!game) {
      return { status: 'not_found' };
    }

    if (game.isGameOver || game.isVictory) {
      return { status: 'game_over' };
    }

    const firstAidKit = game.inventoryItems.find((item) => item.type === 'FIRST_AID_KIT');

    if (!firstAidKit || firstAidKit.quantity <= 0) {
      return { status: 'insufficient_resource' };
    }

    await transaction.inventoryItem.update({
      where: {
        gameId_type: {
          gameId,
          type: 'FIRST_AID_KIT',
        },
      },
      data: {
        quantity: {
          decrement: 1,
        },
      },
    });

    const difficulty = game.difficulty as GameDifficulty;
    const maxHealth = difficulty === 'EASY' ? 120 : 100;
    const message = `Usas el botiquín. Recuperas toda la salud hasta ${maxHealth} y eliminas cualquier veneno activo.`;

    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: 'SURVIVAL',
        message,
      },
    });

    const updatedGame = await transaction.game.update({
      where: { id: gameId },
      data: {
        health: maxHealth,
        poisonDaysRemaining: 0,
        poisonDamagePerDay: 0,
      },
      include: gameDetailsInclude,
    });

    return {
      status: 'updated',
      game: updatedGame,
      message,
      eventMessages: [message],
    };
  });
}
