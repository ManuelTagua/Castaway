import { prisma } from '../prisma/client.js';
import { gameDetailsInclude } from './game.service.js';

export const allowedStructures = [
  'CAMPFIRE',
  'FISHING_ROD',
  'BASIC_SHELTER',
  'WATER_COLLECTOR',
  'SIGNAL_FIRE',
  'STONE_KNIFE',
  'WOODEN_AXE',
  'LEAF_BASKET',
  'WATER_FILTER',
  'IMPROVED_SHELTER',
  'LARGE_WATER_COLLECTOR',
  'FIRST_AID_KIT',
  'IMPROVISED_RAFT',
  'REPAIRED_RADIO',
  'SIGNAL_MIRROR',
] as const;

export type StructureType = (typeof allowedStructures)[number];
type ResourceType = 'FOOD' | 'WATER' | 'WOOD' | 'STONE' | 'FIBER' | 'RADIO_PARTS' | 'BROKEN_RADIO';
type StructureCost = Partial<Record<ResourceType, number>>;

export type BuildResult =
  | { status: 'built'; game: unknown }
  | { status: 'not_found' }
  | { status: 'game_over' }
  | { status: 'already_built' }
  | { status: 'insufficient_resources' }
  | { status: 'missing_requirements' };

export const structureCosts: Record<StructureType, StructureCost> = {
  CAMPFIRE: {
    WOOD: 3,
    STONE: 2,
  },
  FISHING_ROD: {
    WOOD: 2,
    FIBER: 3,
  },
  BASIC_SHELTER: {
    WOOD: 6,
    FIBER: 4,
  },
  WATER_COLLECTOR: {
    WOOD: 4,
    FIBER: 2,
    STONE: 2,
  },
  SIGNAL_FIRE: {
    WOOD: 8,
    STONE: 4,
    FIBER: 3,
  },
  STONE_KNIFE: {
    STONE: 2,
    FIBER: 1,
  },
  WOODEN_AXE: {
    WOOD: 3,
    STONE: 2,
    FIBER: 2,
  },
  LEAF_BASKET: {
    FIBER: 4,
    WOOD: 1,
  },
  WATER_FILTER: {
    WOOD: 4,
    STONE: 3,
    FIBER: 3,
  },
  IMPROVED_SHELTER: {
    WOOD: 10,
    FIBER: 8,
    STONE: 4,
  },
  LARGE_WATER_COLLECTOR: {
    WOOD: 8,
    FIBER: 5,
    STONE: 4,
  },
  FIRST_AID_KIT: {
    FIBER: 5,
    WATER: 2,
    STONE: 1,
  },
  IMPROVISED_RAFT: {
    WOOD: 20,
    FIBER: 14,
    STONE: 4,
  },
  REPAIRED_RADIO: {
    RADIO_PARTS: 3,
    BROKEN_RADIO: 1,
    FIBER: 2,
  },
  SIGNAL_MIRROR: {
    STONE: 2,
    FIBER: 1,
  },
};

const structureLabels: Record<StructureType, string> = {
  CAMPFIRE: 'una fogata',
  FISHING_ROD: 'una caña de pescar',
  BASIC_SHELTER: 'un refugio básico',
  WATER_COLLECTOR: 'un recolector de agua',
  SIGNAL_FIRE: 'una señal de rescate',
  STONE_KNIFE: 'un cuchillo de piedra',
  WOODEN_AXE: 'un hacha de madera',
  LEAF_BASKET: 'una cesta de hojas',
  WATER_FILTER: 'un filtro de agua',
  IMPROVED_SHELTER: 'un refugio mejorado',
  LARGE_WATER_COLLECTOR: 'un recolector de agua más eficiente',
  FIRST_AID_KIT: 'un botiquín',
  IMPROVISED_RAFT: 'una barca improvisada',
  REPAIRED_RADIO: 'una radio de emergencia',
  SIGNAL_MIRROR: 'un espejo de señales',
};

const structureMessages: Partial<Record<StructureType, string>> = {
  IMPROVED_SHELTER: 'Has mejorado tu refugio.',
  LARGE_WATER_COLLECTOR: 'Has construido un recolector de agua más eficiente.',
  FIRST_AID_KIT: 'Has preparado un botiquín. Puede curar toda tu salud y eliminar cualquier veneno activo.',
  IMPROVISED_RAFT: 'Has construido una barca improvisada. Puedes intentar abandonar la isla, pero es arriesgado.',
  REPAIRED_RADIO: 'Has reparado la radio de emergencia. Puedes emitir señales para pedir rescate.',
  SIGNAL_MIRROR: 'Has preparado un espejo de señales. Los destellos aumentan mucho tus opciones de rescate.',
};

export function isStructureType(structure: unknown): structure is StructureType {
  return typeof structure === 'string' && allowedStructures.includes(structure as StructureType);
}

export async function buildStructure(gameId: string, structure: StructureType): Promise<BuildResult> {
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

    if (
      structure !== 'FIRST_AID_KIT' &&
      game.builtStructures.some((builtStructure) => builtStructure.type === structure)
    ) {
      return { status: 'already_built' };
    }

    if (
      structure === 'FIRST_AID_KIT' &&
      (game.inventoryItems.find((item) => item.type === 'FIRST_AID_KIT')?.quantity ?? 0) > 0
    ) {
      return { status: 'already_built' };
    }

    if (structure === 'SIGNAL_FIRE') {
      const hasCampfire = game.builtStructures.some(
        (builtStructure) => builtStructure.type === 'CAMPFIRE',
      );
      const hasCliffs = game.discoveredZones.some((zone) => zone.zone === 'CLIFFS');

      if (!hasCampfire || !hasCliffs) {
        return { status: 'missing_requirements' };
      }
    }

    if (structure === 'IMPROVED_SHELTER') {
      const hasBasicShelter = game.builtStructures.some(
        (builtStructure) => builtStructure.type === 'BASIC_SHELTER',
      );

      if (!hasBasicShelter) {
        return { status: 'missing_requirements' };
      }
    }

    if (structure === 'LARGE_WATER_COLLECTOR') {
      const hasWaterCollector = game.builtStructures.some(
        (builtStructure) => builtStructure.type === 'WATER_COLLECTOR',
      );

      if (!hasWaterCollector) {
        return { status: 'missing_requirements' };
      }
    }

    if (structure === 'SIGNAL_MIRROR') {
      const hasCliffs = game.discoveredZones.some((zone) => zone.zone === 'CLIFFS');

      if (!hasCliffs) {
        return { status: 'missing_requirements' };
      }
    }

    if (structure === 'IMPROVISED_RAFT') {
      const hasKnife = game.builtStructures.some((builtStructure) => builtStructure.type === 'STONE_KNIFE');
      const hasAxe = game.builtStructures.some((builtStructure) => builtStructure.type === 'WOODEN_AXE');

      if (!hasKnife || !hasAxe) {
        return { status: 'missing_requirements' };
      }
    }

    if (structure === 'REPAIRED_RADIO') {
      const hasBrokenRadio = (game.inventoryItems.find((item) => item.type === 'BROKEN_RADIO')?.quantity ?? 0) > 0;

      if (!hasBrokenRadio) {
        return { status: 'missing_requirements' };
      }
    }

    const inventory = new Map(
      game.inventoryItems.map((item) => [item.type as ResourceType, item.quantity]),
    );
    const cost = structureCosts[structure];

    const canBuild = Object.entries(cost).every(
      ([type, quantity]) => (inventory.get(type as ResourceType) ?? 0) >= quantity,
    );

    if (!canBuild) {
      return { status: 'insufficient_resources' };
    }

    for (const [type, quantity] of Object.entries(cost)) {
      await transaction.inventoryItem.update({
        where: {
          gameId_type: {
            gameId,
            type,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });
    }

    if (structure === 'FIRST_AID_KIT') {
      await transaction.inventoryItem.upsert({
        where: {
          gameId_type: {
            gameId,
            type: 'FIRST_AID_KIT',
          },
        },
        create: {
          gameId,
          type: 'FIRST_AID_KIT',
          quantity: 1,
        },
        update: {
          quantity: 1,
        },
      });
    } else {
      await transaction.builtStructure.create({
        data: {
          gameId,
          type: structure,
        },
      });
    }

    await transaction.eventLog.create({
      data: {
        gameId,
        day: game.day,
        type: 'BUILD',
        message: structureMessages[structure] ?? `Has construido ${structureLabels[structure]}.`,
      },
    });

    const updatedGame = await transaction.game.findUniqueOrThrow({
      where: {
        id: gameId,
      },
      include: gameDetailsInclude,
    });

    return {
      status: 'built',
      game: updatedGame,
    };
  });
}
