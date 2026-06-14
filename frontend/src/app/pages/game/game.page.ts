import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  BuiltStructure,
  EventLog,
  Game,
  GameDifficulty,
  InventoryItem,
  Weather,
  Zone,
} from '../../models/game.model';
import { ExploreZone, GameAction, GameService, StructureType } from '../../services/game.service';

type GameLoadStatus = 'loading' | 'ready' | 'error';
type ResourceType = InventoryItem['type'];
type SideTab = 'inventory' | 'build' | 'survival' | 'diary';

interface StatBar {
  label: string;
  value: number;
  className: string;
}

interface DailyAction {
  label: string;
  action: GameAction;
}

interface ResourceView {
  label: string;
  type: ResourceType;
  quantity: number;
}

interface StructureCard {
  type: StructureType;
  name: string;
  description: string;
  effect: string;
  cost: Partial<Record<ResourceType, number>>;
  message: string;
  requirement?: string;
}

interface StructureView extends StructureCard {
  isBuilt: boolean;
  canBuild: boolean;
  costText: string;
}

interface ZoneCard {
  type: Zone;
  name: string;
  effect: string;
  exploreHint?: string;
  isDiscovered: boolean;
}

interface RescueStatus {
  hasSignalFire: boolean;
  canBuildSignalFire: boolean;
  text: string;
}

interface DiaryDayGroup {
  day: number;
  events: EventLog[];
}

const resourceLabels: Record<ResourceType, string> = {
  FOOD: 'Comida',
  WATER: 'Agua',
  WOOD: 'Madera',
  STONE: 'Piedra',
  FIBER: 'Fibra',
  RAW_FISH: 'Pescado crudo',
  COOKED_FISH: 'Pescado cocinado',
  COCONUT: 'Coco',
  DIRTY_WATER: 'Agua no potable',
};

const weatherLabels: Record<Weather, string> = {
  SUNNY: 'Soleado',
  CLOUDY: 'Nublado',
  RAIN: 'Lluvia',
  STORM: 'Tormenta',
};

const difficultyLabels: Record<GameDifficulty, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
};

const islandZones: Array<Omit<ZoneCard, 'isDiscovered'>> = [
  {
    type: 'BEACH',
    name: 'Playa',
    effect: 'Permite buscar agua y pescar.',
  },
  {
    type: 'JUNGLE',
    name: 'Jungla',
    effect: 'Buscar comida tiene más éxito y da +1 comida.',
  },
  {
    type: 'CAVE',
    name: 'Cueva',
    effect: 'Explorar da +1 piedra adicional si tiene éxito.',
  },
  {
    type: 'CLIFFS',
    name: 'Acantilados',
    effect: 'Zona preparada para señales de rescate.',
  },
];

const resourceOrder: ResourceType[] = [
  'FOOD',
  'WATER',
  'COCONUT',
  'RAW_FISH',
  'COOKED_FISH',
  'DIRTY_WATER',
  'WOOD',
  'STONE',
  'FIBER',
];

@Component({
  selector: 'app-game-page',
  imports: [RouterLink],
  templateUrl: './game.page.html',
  styleUrl: './game.page.scss',
})
export class GamePage implements OnInit {
  protected readonly game = signal<Game | null>(null);
  protected readonly loadStatus = signal<GameLoadStatus>('loading');
  protected readonly activeTab = signal<SideTab>('inventory');
  protected readonly isPerformingAction = signal(false);
  protected readonly isBuilding = signal(false);
  protected readonly isUsingSurvivalAction = signal(false);
  protected readonly actionError = signal('');
  protected readonly buildError = signal('');
  protected readonly survivalError = signal('');
  protected readonly lastActionMessage = signal('');
  protected readonly lastEventMessages = signal<string[]>([]);
  protected readonly diaryVisibleCount = signal(10);
  protected readonly selectedExploreZone = signal<ExploreZone>('BEACH');

  private readonly baseDailyActions: DailyAction[] = [
    { label: 'Buscar comida', action: 'FORAGE' },
    { label: 'Buscar agua', action: 'SEARCH_WATER' },
    { label: 'Descansar', action: 'REST' },
    { label: 'Explorar', action: 'EXPLORE' },
  ];

  protected readonly structureCards: StructureCard[] = [
    {
      type: 'CAMPFIRE',
      name: 'Fogata',
      description: 'Calor y luz para el campamento.',
      effect: 'Cocina comida mejor y añade cordura al descansar.',
      cost: { WOOD: 3, STONE: 2 },
      message: 'Has construido una fogata.',
    },
    {
      type: 'FISHING_ROD',
      name: 'Caña de pescar',
      description: 'Herramienta básica para conseguir comida en la costa.',
      effect: 'Desbloquea la acción Pescar.',
      cost: { WOOD: 2, FIBER: 3 },
      message: 'Has fabricado una caña de pescar.',
    },
    {
      type: 'BASIC_SHELTER',
      name: 'Refugio básico',
      description: 'Protección sencilla para dormir mejor.',
      effect: 'Mejora Descansar y reduce lluvia y tormentas.',
      cost: { WOOD: 6, FIBER: 4 },
      message: 'Has reforzado el campamento con un refugio básico.',
    },
    {
      type: 'WATER_COLLECTOR',
      name: 'Recolector de agua',
      description: 'Recoge agua en el campamento.',
      effect: 'Mejora Buscar agua y guarda lluvia extra.',
      cost: { WOOD: 4, FIBER: 2, STONE: 2 },
      message: 'Has construido un recolector de agua.',
    },
    {
      type: 'STONE_KNIFE',
      name: 'Cuchillo de piedra',
      description: 'Herramienta básica de corte.',
      effect: 'Aumenta la opción de comida extra y fibra al buscar comida.',
      cost: { STONE: 2, FIBER: 1 },
      message: 'Has fabricado un cuchillo de piedra.',
    },
    {
      type: 'WOODEN_AXE',
      name: 'Hacha de madera',
      description: 'Ayuda a aprovechar ramas y troncos.',
      effect: '+1 madera cuando encuentras madera explorando.',
      cost: { WOOD: 3, STONE: 2, FIBER: 2 },
      message: 'Has fabricado un hacha de madera.',
    },
    {
      type: 'LEAF_BASKET',
      name: 'Cesta de hojas',
      description: 'Permite transportar mejor lo recolectado.',
      effect: 'Puede añadir +1 comida al buscar comida.',
      cost: { FIBER: 4, WOOD: 1 },
      message: 'Has tejido una cesta de hojas.',
    },
    {
      type: 'WATER_FILTER',
      name: 'Filtro de agua',
      description: 'Filtra mejor el agua encontrada.',
      effect: '+1 agua cuando consigues agua potable.',
      cost: { WOOD: 4, STONE: 3, FIBER: 3 },
      message: 'Has construido un filtro de agua.',
    },
    {
      type: 'SIGNAL_FIRE',
      name: 'Señal de rescate',
      description: 'Una gran señal visible desde los acantilados.',
      effect: 'Activa la posibilidad de rescate al terminar el día.',
      requirement: 'Requiere fogata y acantilados descubiertos.',
      cost: { WOOD: 8, STONE: 4, FIBER: 3 },
      message: 'Has construido una señal de rescate.',
    },
    {
      type: 'IMPROVED_SHELTER',
      name: 'Refugio mejorado',
      description: 'Un refugio reforzado para noches duras.',
      effect: 'Descansar recupera mas energia y reduce tormentas y perdidas nocturnas.',
      requirement: 'Requiere refugio basico',
      cost: { WOOD: 10, FIBER: 8, STONE: 4 },
      message: 'Has mejorado tu refugio.',
    },
    {
      type: 'LARGE_WATER_COLLECTOR',
      name: 'Recolector grande',
      description: 'Mas superficie para recoger lluvia.',
      effect: 'Genera mas agua cuando llueve y mejora la supervivencia en dias de lluvia.',
      requirement: 'Requiere recolector de agua',
      cost: { WOOD: 8, FIBER: 5, STONE: 4 },
      message: 'Has construido un recolector de agua mas eficiente.',
    },
  ];

  protected readonly stats = computed<StatBar[]>(() => {
    const game = this.game();

    if (!game) {
      return [];
    }

    return [
      { label: 'Salud', value: game.health, className: 'health' },
      { label: 'Hambre', value: game.hunger, className: 'hunger' },
      { label: 'Sed', value: game.thirst, className: 'thirst' },
      { label: 'Energía', value: game.energy, className: 'energy' },
      { label: 'Cordura', value: game.sanity, className: 'sanity' },
    ];
  });

  protected readonly weatherLabel = computed(() => {
    const weather = this.game()?.weather;
    return weather ? weatherLabels[weather] : '-';
  });

  protected readonly difficultyLabel = computed(() => {
    const difficulty = this.game()?.difficulty;
    return difficulty ? difficultyLabels[difficulty] : '-';
  });

  protected readonly dailyActions = computed<DailyAction[]>(() => {
    const actions = [...this.baseDailyActions];

    if (this.hasBuiltStructure('FISHING_ROD')) {
      actions.push({ label: 'Pescar', action: 'FISH' });
    }

    return actions;
  });

  protected readonly inventory = computed<ResourceView[]>(() => {
    const quantities = this.inventoryQuantities();

    return resourceOrder.map((type) => ({
      type,
      label: resourceLabels[type],
      quantity: quantities.get(type) ?? 0,
    }));
  });

  protected readonly structures = computed<StructureView[]>(() => {
    const game = this.game();
    const quantities = this.inventoryQuantities();
    const builtTypes = new Set(
      (game?.builtStructures ?? []).map((structure: BuiltStructure) => structure.type),
    );

    return this.structureCards.map((structure) => {
      const canBuild = Object.entries(structure.cost).every(
        ([type, quantity]) => (quantities.get(type as ResourceType) ?? 0) >= quantity,
      );
      const hasRequirements =
        (structure.type !== 'SIGNAL_FIRE' ||
          (this.hasBuiltStructure('CAMPFIRE') && this.hasDiscoveredZone('CLIFFS'))) &&
        (structure.type !== 'IMPROVED_SHELTER' || this.hasBuiltStructure('BASIC_SHELTER')) &&
        (structure.type !== 'LARGE_WATER_COLLECTOR' || this.hasBuiltStructure('WATER_COLLECTOR'));

      return {
        ...structure,
        isBuilt: builtTypes.has(structure.type),
        canBuild: canBuild && hasRequirements,
        costText: Object.entries(structure.cost)
          .map(([type, quantity]) => `${resourceLabels[type as ResourceType]} ${quantity}`)
          .join(' · '),
      };
    });
  });

  protected readonly zones = computed<ZoneCard[]>(() => {
    const discovered = new Set((this.game()?.discoveredZones ?? []).map((zone) => zone.zone));

    return islandZones.map((zone) => ({
      ...zone,
      isDiscovered: discovered.has(zone.type),
    }));
  });

  protected readonly rescueStatus = computed<RescueStatus>(() => {
    const progress = this.game()?.rescueProgress ?? 0;
    const hasSignalFire = this.hasBuiltStructure('SIGNAL_FIRE');
    const canBuildSignalFire = this.hasBuiltStructure('CAMPFIRE') && this.hasDiscoveredZone('CLIFFS');

    if (hasSignalFire) {
      return {
        hasSignalFire,
        canBuildSignalFire,
        text: progress >= 75 ? 'Crees haber visto algo en el horizonte.' : 'La señal está activa.',
      };
    }

    return {
      hasSignalFire,
      canBuildSignalFire,
      text: 'Necesitas descubrir los acantilados y construir una señal.',
    };
  });

  protected readonly diaryEvents = computed(() => {
    return (this.game()?.eventLogs ?? []).slice(0, this.diaryVisibleCount());
  });

  protected readonly diaryGroups = computed<DiaryDayGroup[]>(() => {
    const groups = new Map<number, EventLog[]>();

    for (const event of this.diaryEvents()) {
      groups.set(event.day, [...(groups.get(event.day) ?? []), event]);
    }

    return Array.from(groups.entries()).map(([day, events]) => ({ day, events }));
  });

  protected readonly canShowMoreDiary = computed(
    () => (this.game()?.eventLogs.length ?? 0) > this.diaryVisibleCount(),
  );

  protected readonly canEat = computed(() => this.resourceQuantity('FOOD') > 0);
  protected readonly canDrink = computed(() => this.resourceQuantity('WATER') > 0);
  protected readonly canEatCookedFish = computed(() => this.resourceQuantity('COOKED_FISH') > 0);
  protected readonly canEatCoconut = computed(() => this.resourceQuantity('COCONUT') > 0);
  protected readonly canCookFish = computed(
    () => this.resourceQuantity('RAW_FISH') > 0 && this.hasBuiltStructure('CAMPFIRE'),
  );
  protected readonly canFilterWater = computed(
    () => this.resourceQuantity('DIRTY_WATER') > 0 && this.hasBuiltStructure('WATER_FILTER'),
  );
  protected readonly shouldEndDay = computed(() => (this.game()?.actionsRemaining ?? 0) <= 0);

  constructor(
    private readonly gameService: GameService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loadStatus.set('error');
      return;
    }

    this.gameService.getGameById(id).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loadStatus.set('ready');
      },
      error: () => {
        this.loadStatus.set('error');
      },
    });
  }

  protected selectTab(tab: SideTab): void {
    this.activeTab.set(tab);
  }

  protected showMoreDiary(): void {
    this.diaryVisibleCount.update((count) => count + 10);
  }

  protected selectExploreZone(zone: Zone): void {
    if (this.hasDiscoveredZone(zone)) {
      this.selectedExploreZone.set(zone as ExploreZone);
    }
  }

  protected zoneBenefit(zone: Zone): string {
    const benefits: Record<Zone, string> = {
      BEACH: 'Agua, fibra y restos de madera. Puede revelar la jungla.',
      JUNGLE: 'Comida, fibra y madera. Puede revelar la cueva.',
      CAVE: 'Piedra y algún recurso raro. Puede revelar los acantilados.',
      CLIFFS: 'Madera, piedra y vista para el rescate.',
    };

    return benefits[zone];
  }

  protected structureMark(type: StructureType): string {
    const marks: Record<StructureType, string> = {
      CAMPFIRE: 'F',
      FISHING_ROD: 'P',
      BASIC_SHELTER: 'R',
      WATER_COLLECTOR: 'A',
      SIGNAL_FIRE: 'S',
      STONE_KNIFE: 'C',
      WOODEN_AXE: 'H',
      LEAF_BASKET: 'B',
      WATER_FILTER: 'W',
      IMPROVED_SHELTER: 'M',
      LARGE_WATER_COLLECTOR: 'G',
    };

    return marks[type];
  }

  protected performAction(dailyAction: DailyAction): void {
    const game = this.game();

    if (!game || game.isGameOver || game.isVictory || game.actionsRemaining <= 0 || this.isPerformingAction()) {
      return;
    }

    this.isPerformingAction.set(true);
    this.clearErrors();

    const zone = dailyAction.action === 'EXPLORE' ? this.selectedExploreZone() : null;

    this.gameService.performAction(game.id, dailyAction.action, zone).subscribe({
      next: (response) => {
        this.game.set(response.game);
        this.lastActionMessage.set(response.message);
        this.lastEventMessages.set([]);
        this.isPerformingAction.set(false);
      },
      error: () => {
        this.actionError.set('No se pudo realizar la acción');
        this.isPerformingAction.set(false);
      },
    });
  }

  protected eat(): void {
    this.useSurvivalAction('eat');
  }

  protected drink(): void {
    this.useSurvivalAction('drink');
  }

  protected eatCookedFish(): void {
    this.useSurvivalAction('eatCookedFish');
  }

  protected eatCoconut(): void {
    this.useSurvivalAction('eatCoconut');
  }

  protected cookFish(): void {
    this.useSurvivalAction('cookFish');
  }

  protected filterWater(): void {
    this.useSurvivalAction('filterWater');
  }

  protected endDay(): void {
    this.useSurvivalAction('endDay');
  }

  protected build(structure: StructureView): void {
    const game = this.game();

    if (!game || game.isGameOver || game.isVictory || structure.isBuilt || !structure.canBuild || this.isBuilding()) {
      return;
    }

    this.isBuilding.set(true);
    this.clearErrors();

    this.gameService.buildStructure(game.id, structure.type).subscribe({
      next: (updatedGame) => {
        this.game.set(updatedGame);
        this.lastActionMessage.set(structure.message);
        this.lastEventMessages.set([]);
        this.isBuilding.set(false);
      },
      error: () => {
        this.buildError.set('No se pudo construir la estructura');
        this.isBuilding.set(false);
      },
    });
  }

  private useSurvivalAction(
    action: 'eat' | 'drink' | 'eatCookedFish' | 'eatCoconut' | 'cookFish' | 'filterWater' | 'endDay',
  ): void {
    const game = this.game();

    if (!game || game.isGameOver || game.isVictory || this.isUsingSurvivalAction()) {
      return;
    }

    this.isUsingSurvivalAction.set(true);
    this.clearErrors();

    this.gameService[action](game.id).subscribe({
      next: (response) => {
        this.game.set(response.game);
        this.lastActionMessage.set(response.message);
        this.lastEventMessages.set(
          response.eventMessages?.length
            ? [response.eventMessages[0]]
            : response.eventMessage
              ? [response.eventMessage]
              : [],
        );
        this.isUsingSurvivalAction.set(false);
      },
      error: () => {
        this.survivalError.set('No se pudo realizar la acción libre');
        this.isUsingSurvivalAction.set(false);
      },
    });
  }

  private clearErrors(): void {
    this.actionError.set('');
    this.buildError.set('');
    this.survivalError.set('');
  }

  private hasBuiltStructure(type: StructureType): boolean {
    return this.game()?.builtStructures.some((structure) => structure.type === type) ?? false;
  }

  private hasDiscoveredZone(type: Zone): boolean {
    return this.game()?.discoveredZones.some((zone) => zone.zone === type) ?? false;
  }

  private resourceQuantity(type: ResourceType): number {
    return this.inventoryQuantities().get(type) ?? 0;
  }

  private inventoryQuantities(): Map<ResourceType, number> {
    const game = this.game();
    const quantities = new Map<ResourceType, number>();

    for (const item of game?.inventoryItems ?? []) {
      quantities.set(item.type, item.quantity);
    }

    return quantities;
  }
}
