import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  BuiltStructure,
  EventLog,
  Game,
  GameDifficulty,
  InventoryItem,
  Weather,
  Zone,
} from '../../models/game.model';
import {
  DecisionChoice,
  ExploreZone,
  GameAction,
  GameService,
  StructureType,
} from '../../services/game.service';

type GameLoadStatus = 'loading' | 'ready' | 'error';
type ResourceType = InventoryItem['type'];
type SideTab = 'inventory' | 'build' | 'survival' | 'diary';
type ImportantModalKind = 'victory' | 'game-over' | 'discovery' | 'signal' | 'narrative';

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
  isRevealed: boolean;
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

interface DiaryDayGroup {
  day: number;
  events: EventLog[];
}

interface ImportantModal {
  kind: ImportantModalKind;
  eyebrow: string;
  title: string;
  body: string;
  stats?: Array<{ label: string; value: string | number }>;
}

interface DecisionEventView {
  title: string;
  body: string;
  choices: Array<{ key: DecisionChoice; label: string }>;
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
  ANTIDOTE: 'Cura',
  FIRST_AID_KIT: 'Botiquín',
  BROKEN_RADIO: 'Radio rota',
  RADIO_PARTS: 'Piezas de radio',
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
];

const initiallyRevealedResources = new Set<ResourceType>([
  'FOOD',
  'WATER',
  'WOOD',
  'STONE',
  'FIBER',
]);

const decisionEventViews: Record<string, DecisionEventView> = {
  DECISION_ABANDONED_BACKPACK: {
    title: 'Mochila abandonada',
    body: 'Encuentras una mochila abandonada medio enterrada. Podría tener suministros... o algo peor.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_STRANGE_FOOTPRINTS: {
    title: 'Huellas extrañas',
    body: 'Un rastro de huellas se aleja entre la vegetación.',
    choices: [
      { key: 'FOLLOW', label: 'Seguirlas' },
      { key: 'IGNORE', label: 'Ignorarlas' },
    ],
  },
  DECISION_WILD_BOAR: {
    title: 'Jabalí cerca del campamento',
    body: 'Un jabalí se acerca demasiado a tus provisiones.',
    choices: [
      { key: 'SCARE', label: 'Espantar' },
      { key: 'HIDE', label: 'Esconderse' },
    ],
  },
  DECISION_SEA_CRATE: {
    title: 'Caja arrastrada por el mar',
    body: 'Una caja golpeada por las olas queda varada en la arena.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'LEAVE', label: 'Dejarla' },
    ],
  },
  DECISION_SEA_CANISTER: {
    title: 'Bote arrastrado por el mar',
    body: 'Un bote metálico cerrado aparece entre restos de marea.',
    choices: [
      { key: 'OPEN', label: 'Abrir' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_STRANGE_FRUIT_TREE: {
    title: 'Árbol frutal extraño',
    body: 'El Árbol tiene frutos brillantes que no reconoces.',
    choices: [
      { key: 'EAT', label: 'Comer' },
      { key: 'KEEP', label: 'Guardar' },
    ],
  },
  DECISION_INJURED_ANIMAL: {
    title: 'Animal herido',
    body: 'Un animal pequeño tiembla junto a unas rocas. Ayudarlo podría costarte recursos.',
    choices: [
      { key: 'HELP', label: 'Ayudar' },
      { key: 'IGNORE', label: 'Ignorar' },
    ],
  },
  DECISION_DISTANT_SMOKE: {
    title: 'Humo en la distancia',
    body: 'Una columna de humo se eleva lejos del campamento.',
    choices: [
      { key: 'INVESTIGATE', label: 'Investigar' },
      { key: 'STAY', label: 'Quedarse' },
    ],
  },
  DECISION_SHIPWRECK_DEBRIS: {
    title: 'Restos de barco',
    body: 'Encuentras tablones rotos y cajas atrapadas entre las rocas.',
    choices: [
      { key: 'SEARCH', label: 'Registrar' },
      { key: 'LEAVE', label: 'Marcharse' },
    ],
  },
};

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
  protected readonly isResolvingDecision = signal(false);
  protected readonly actionError = signal('');
  protected readonly buildError = signal('');
  protected readonly survivalError = signal('');
  protected readonly lastActionMessage = signal('');
  protected readonly lastEventMessages = signal<string[]>([]);
  protected readonly diaryVisibleCount = signal(10);
  protected readonly selectedExploreZone = signal<ExploreZone>('BEACH');
  protected readonly importantModal = signal<ImportantModal | null>(null);
  protected readonly isMapOpen = signal(false);
  protected readonly isHelpOpen = signal(false);
  protected readonly failedMapImage = signal('');

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
      effect: 'Descansar recupera más energía y reduce tormentas y pérdidas nocturnas.',
      requirement: 'Requiere refugio básico',
      cost: { WOOD: 10, FIBER: 8, STONE: 4 },
      message: 'Has mejorado tu refugio.',
    },
    {
      type: 'LARGE_WATER_COLLECTOR',
      name: 'Recolector grande',
      description: 'Más superficie para recoger lluvia.',
      effect: 'Genera más agua cuando llueve y mejora la supervivencia en días de lluvia.',
      requirement: 'Requiere recolector de agua',
      cost: { WOOD: 8, FIBER: 5, STONE: 4 },
      message: 'Has construido un recolector de agua más eficiente.',
    },
    {
      type: 'FIRST_AID_KIT',
      name: 'Botiquín',
      description: 'Suministros médicos preparados para una emergencia.',
      effect: 'Al usarlo cura toda la salud y elimina el veneno. Maximo 1.',
      cost: { FIBER: 5, WATER: 2, STONE: 1 },
      message: 'Has preparado un botiquín.',
    },
    {
      type: 'IMPROVISED_RAFT',
      name: 'Barca improvisada',
      description: 'Una salida desesperada por mar abierto.',
      effect: 'Desbloquea Abandonar la isla. Puede darte un final alternativo o matarte.',
      requirement: 'Requiere cuchillo de piedra y hacha de madera',
      cost: { WOOD: 20, FIBER: 14, STONE: 4 },
      message: 'Has construido una barca improvisada.',
    },
    {
      type: 'REPAIRED_RADIO',
      name: 'Reparar radio',
      description: 'Convierte una radio rota en una llamada de emergencia.',
      effect: 'Desbloquea Emitir señal. Tras varias señales llega un rescate alternativo.',
      requirement: 'Requiere radio rota y 3 piezas de radio',
      cost: { BROKEN_RADIO: 1, RADIO_PARTS: 3, FIBER: 2 },
      message: 'Has reparado la radio de emergencia.',
    },
    {
      type: 'SIGNAL_MIRROR',
      name: 'Espejo de señales',
      description: 'Destellos de luz desde los acantilados.',
      effect: 'Aumenta mucho la velocidad del rescate si tienes señal de rescate.',
      requirement: 'Requiere acantilados descubiertos',
      cost: { STONE: 2, FIBER: 1 },
      message: 'Has preparado un espejo de señales.',
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
    const actions: DailyAction[] = [...this.baseDailyActions, { label: 'Pescar', action: 'FISH' }];

    if (this.hasBuiltStructure('IMPROVISED_RAFT')) {
      actions.push({ label: 'Abandonar la isla', action: 'LEAVE_ISLAND' });
    }

    if (this.hasBuiltStructure('REPAIRED_RADIO')) {
      actions.push({ label: 'Emitir señal', action: 'SEND_RADIO_SIGNAL' });
    }

    return actions;
  });

  protected readonly inventory = computed<ResourceView[]>(() => {
    const quantities = this.inventoryQuantities();
    const discoveredResources = new Set(
      (this.game()?.inventoryItems ?? []).map((item) => item.type as ResourceType),
    );

    return resourceOrder.map((type) => ({
      type,
      label: resourceLabels[type],
      quantity: quantities.get(type) ?? 0,
      isRevealed: initiallyRevealedResources.has(type) || discoveredResources.has(type),
    }));
  });

  protected readonly mapStage = computed(() => {
    if (
      this.hasDiscoveredZone('BEACH') &&
      this.hasDiscoveredZone('JUNGLE') &&
      this.hasDiscoveredZone('CAVE') &&
      this.hasDiscoveredZone('CLIFFS')
    ) {
      return 4;
    }

    if (
      this.hasDiscoveredZone('BEACH') &&
      this.hasDiscoveredZone('JUNGLE') &&
      this.hasDiscoveredZone('CAVE')
    ) {
      return 3;
    }

    if (this.hasDiscoveredZone('BEACH') && this.hasDiscoveredZone('JUNGLE')) {
      return 2;
    }

    return 1;
  });

  protected readonly mapImageSrc = computed(
    () => `assets/maps/island_stage_${this.mapStage()}.png`,
  );

  protected readonly canShowMapImage = computed(() => this.failedMapImage() !== this.mapImageSrc());

  protected readonly structures = computed<StructureView[]>(() => {
    const game = this.game();
    const quantities = this.inventoryQuantities();
    const builtTypes = new Set(
      (game?.builtStructures ?? []).map((structure: BuiltStructure) => structure.type),
    );

    return this.structureCards.map((structure) => {
      const hasFirstAidKit = this.resourceQuantity('FIRST_AID_KIT') > 0;
      const canBuild = Object.entries(structure.cost).every(
        ([type, quantity]) => (quantities.get(type as ResourceType) ?? 0) >= quantity,
      );
      const hasRequirements =
        (structure.type !== 'SIGNAL_FIRE' ||
          (this.hasBuiltStructure('CAMPFIRE') && this.hasDiscoveredZone('CLIFFS'))) &&
        (structure.type !== 'SIGNAL_MIRROR' || this.hasDiscoveredZone('CLIFFS')) &&
        (structure.type !== 'IMPROVED_SHELTER' || this.hasBuiltStructure('BASIC_SHELTER')) &&
        (structure.type !== 'LARGE_WATER_COLLECTOR' || this.hasBuiltStructure('WATER_COLLECTOR')) &&
        (structure.type !== 'IMPROVISED_RAFT' ||
          (this.hasBuiltStructure('STONE_KNIFE') && this.hasBuiltStructure('WOODEN_AXE'))) &&
        (structure.type !== 'REPAIRED_RADIO' || this.resourceQuantity('BROKEN_RADIO') > 0);

      return {
        ...structure,
        isBuilt:
          structure.type === 'FIRST_AID_KIT' ? hasFirstAidKit : builtTypes.has(structure.type),
        canBuild:
          canBuild && hasRequirements && (structure.type !== 'FIRST_AID_KIT' || !hasFirstAidKit),
        costText: Object.entries(structure.cost)
          .map(([type, quantity]) => `${resourceLabels[type as ResourceType]} ${quantity}`)
          .join(' \u00b7 '),
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

  protected readonly diaryEvents = computed(() => {
    return (this.game()?.eventLogs ?? []).slice(0, this.diaryVisibleCount());
  });

  protected readonly latestCampEvent = computed(() => {
    return (
      this.lastEventMessages()[0] ||
      this.lastActionMessage() ||
      'El campamento espera tu siguiente decisión.'
    );
  });

  protected readonly latestCampEventType = computed(() => {
    const message = this.latestCampEvent().toLowerCase();

    if (message.includes('constru')) {
      return 'Construcción';
    }

    if (message.includes('noche') || message.includes('tormenta') || message.includes('lluvia')) {
      return 'Evento nocturno';
    }

    if (message.includes('encontr') || message.includes('descub')) {
      return 'Hallazgo';
    }

    return 'Evento importante';
  });

  protected readonly latestCampEventIcon = computed(() => {
    const type = this.latestCampEventType();

    if (type === 'Construcción') {
      return 'C';
    }

    if (type === 'Evento nocturno') {
      return 'N';
    }

    if (type === 'Hallazgo') {
      return 'H';
    }

    return '!';
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
  protected readonly decisionEvent = computed(() => {
    const key = this.game()?.pendingDecisionEventKey;
    return key ? (decisionEventViews[key] ?? null) : null;
  });
  protected readonly poisonStatus = computed(() => {
    const game = this.game();

    if (!game || game.poisonDaysRemaining <= 0 || game.poisonDamagePerDay <= 0) {
      return null;
    }

    return `Veneno: ${game.poisonDamagePerDay} daño por día durante ${game.poisonDaysRemaining} días.`;
  });
  protected readonly canUseAntidote = computed(
    () => this.resourceQuantity('ANTIDOTE') > 0 && (this.game()?.poisonDaysRemaining ?? 0) > 0,
  );
  protected readonly canUseFirstAidKit = computed(() => this.resourceQuantity('FIRST_AID_KIT') > 0);
  protected readonly activeStatuses = computed(() => {
    const game = this.game();

    if (!game || game.poisonDaysRemaining <= 0 || game.poisonDamagePerDay <= 0) {
      return [];
    }

    return [
      {
        icon: '!',
        title: 'Envenenado',
        detail: `Duración restante: ${game.poisonDaysRemaining} días. Pierdes ${game.poisonDamagePerDay} salud al finalizar cada día.`,
      },
    ];
  });

  constructor(
    private readonly gameService: GameService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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
        this.presentEndStateModal(null, game);
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

  protected openMap(): void {
    this.isMapOpen.set(true);
  }

  protected closeMap(): void {
    this.isMapOpen.set(false);
  }

  protected handleMapImageError(): void {
    this.failedMapImage.set(this.mapImageSrc());
  }

  protected openHelp(): void {
    this.isHelpOpen.set(true);
  }

  protected closeHelp(): void {
    this.isHelpOpen.set(false);
  }

  protected closeImportantModal(): void {
    this.importantModal.set(null);
  }

  protected retryGame(): void {
    const difficulty = this.game()?.difficulty ?? 'NORMAL';

    this.gameService.createGame(difficulty).subscribe({
      next: (game) => {
        this.importantModal.set(null);
        this.router.navigate(['/game', game.id]);
      },
      error: () => {
        this.importantModal.set({
          kind: 'game-over',
          eyebrow: 'Game over',
          title: 'No se pudo reiniciar',
          body: 'Inténtalo de nuevo desde el menú principal.',
        });
      },
    });
  }

  protected goToMenu(): void {
    this.importantModal.set(null);
    this.router.navigate(['/']);
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

  protected hasSceneStructure(type: StructureType): boolean {
    return this.hasBuiltStructure(type);
  }

  protected isDailyActionDisabled(dailyAction: DailyAction): boolean {
    return (
      this.isPerformingAction() ||
      this.shouldEndDay() ||
      !!this.game()?.pendingDecisionEventKey ||
      !!this.game()?.isGameOver ||
      !!this.game()?.isVictory ||
      (dailyAction.action === 'FISH' && !this.hasBuiltStructure('FISHING_ROD'))
    );
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
      FIRST_AID_KIT: '+',
      IMPROVISED_RAFT: 'B',
      REPAIRED_RADIO: 'R',
      SIGNAL_MIRROR: 'E',
    };

    return marks[type];
  }

  protected performAction(dailyAction: DailyAction): void {
    const game = this.game();

    if (
      !game ||
      game.isGameOver ||
      game.isVictory ||
      game.pendingDecisionEventKey ||
      game.actionsRemaining <= 0 ||
      this.isPerformingAction()
    ) {
      return;
    }

    this.isPerformingAction.set(true);
    this.clearErrors();

    const zone = dailyAction.action === 'EXPLORE' ? this.selectedExploreZone() : null;

    this.gameService.performAction(game.id, dailyAction.action, zone).subscribe({
      next: (response) => {
        const previousGame = this.game();
        this.game.set(response.game);
        this.lastActionMessage.set(
          response.importantEvent?.message ?? response.eventMessages?.[0] ?? response.message,
        );
        this.lastEventMessages.set(response.eventMessages ?? []);
        this.isPerformingAction.set(false);
        this.presentImportantModal(previousGame, response.game);
        if (!response.game.pendingDecisionEventKey) {
          this.presentBackendImportantEvent(response.importantEvent);
        }
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

  protected useAntidote(): void {
    this.useSurvivalAction('useAntidote');
  }

  protected useFirstAidKit(): void {
    this.useSurvivalAction('useFirstAidKit');
  }

  protected endDay(): void {
    this.useSurvivalAction('endDay');
  }

  protected resolveDecision(choice: DecisionChoice): void {
    const game = this.game();

    if (!game || !game.pendingDecisionEventKey || this.isResolvingDecision()) {
      return;
    }

    this.isResolvingDecision.set(true);
    this.clearErrors();

    this.gameService.resolveDecision(game.id, choice).subscribe({
      next: (response) => {
        const previousGame = this.game();
        this.game.set(response.game);
        this.lastActionMessage.set(
          response.importantEvent?.message ?? response.eventMessages?.[0] ?? response.message,
        );
        this.lastEventMessages.set(response.eventMessages ?? []);
        this.isResolvingDecision.set(false);
        this.presentImportantModal(previousGame, response.game);
        this.presentBackendImportantEvent(response.importantEvent);
      },
      error: () => {
        this.actionError.set('No se pudo resolver el evento');
        this.isResolvingDecision.set(false);
      },
    });
  }

  protected build(structure: StructureView): void {
    const game = this.game();

    if (
      !game ||
      game.isGameOver ||
      game.isVictory ||
      game.pendingDecisionEventKey ||
      structure.isBuilt ||
      !structure.canBuild ||
      this.isBuilding()
    ) {
      return;
    }

    this.isBuilding.set(true);
    this.clearErrors();

    this.gameService.buildStructure(game.id, structure.type).subscribe({
      next: (updatedGame) => {
        const previousGame = this.game();
        this.game.set(updatedGame);
        this.lastActionMessage.set(structure.message);
        this.lastEventMessages.set([]);
        this.isBuilding.set(false);
        this.presentImportantModal(previousGame, updatedGame, structure.type);
      },
      error: () => {
        this.buildError.set('No se pudo construir la estructura');
        this.isBuilding.set(false);
      },
    });
  }

  private useSurvivalAction(
    action:
      | 'eat'
      | 'drink'
      | 'eatCookedFish'
      | 'eatCoconut'
      | 'cookFish'
      | 'filterWater'
      | 'useAntidote'
      | 'useFirstAidKit'
      | 'endDay',
  ): void {
    const game = this.game();

    if (
      !game ||
      game.isGameOver ||
      game.isVictory ||
      (game.pendingDecisionEventKey && action !== 'useAntidote') ||
      this.isUsingSurvivalAction()
    ) {
      return;
    }

    this.isUsingSurvivalAction.set(true);
    this.clearErrors();

    this.gameService[action](game.id).subscribe({
      next: (response) => {
        const previousGame = this.game();
        this.game.set(response.game);
        this.lastActionMessage.set(
          response.importantEvent?.message ?? response.eventMessages?.[0] ?? response.message,
        );
        this.lastEventMessages.set(
          response.eventMessages?.length
            ? response.eventMessages
            : response.eventMessage
              ? [response.eventMessage]
              : [],
        );
        this.isUsingSurvivalAction.set(false);
        this.presentImportantModal(previousGame, response.game);
        if (!response.game.pendingDecisionEventKey) {
          this.presentBackendImportantEvent(response.importantEvent);
        }
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

  private presentImportantModal(
    previousGame: Game | null,
    nextGame: Game,
    builtStructure?: StructureType,
  ): void {
    if (this.presentEndStateModal(previousGame, nextGame)) {
      return;
    }

    if (builtStructure === 'SIGNAL_FIRE') {
      this.importantModal.set({
        kind: 'signal',
        eyebrow: 'Rescate',
        title: 'Señal de rescate construida',
        body: 'El humo ya puede verse desde los acantilados. Termina días para aumentar tus opciones de rescate.',
      });
      return;
    }

    const previousZones = new Set(previousGame?.discoveredZones.map((zone) => zone.zone) ?? []);
    const discoveredZone = nextGame.discoveredZones.find((zone) => !previousZones.has(zone.zone));

    if (discoveredZone) {
      const zone = islandZones.find((islandZone) => islandZone.type === discoveredZone.zone);

      this.importantModal.set({
        kind: 'discovery',
        eyebrow: 'Nueva zona',
        title: zone ? `${zone.name} descubierta` : 'Nueva zona descubierta',
        body: zone?.effect ?? 'La isla revela una nueva ruta para explorar.',
      });
    }
  }

  private presentBackendImportantEvent(
    event: { title: string; message: string } | undefined,
  ): void {
    if (!event || this.importantModal()) {
      return;
    }

    this.importantModal.set({
      kind: 'narrative',
      eyebrow: 'Evento',
      title: event.title,
      body: event.message,
    });
  }

  private presentEndStateModal(previousGame: Game | null, nextGame: Game): boolean {
    const wasVictory = previousGame?.isVictory ?? false;
    const wasGameOver = previousGame?.isGameOver ?? false;

    if (nextGame.isVictory && !wasVictory) {
      this.importantModal.set({
        kind: 'victory',
        eyebrow: 'Rescate',
        title: nextGame.endingTitle ?? 'Has sido rescatado',
        body:
          nextGame.endingType === 'LEGENDARY_SURVIVOR'
            ? 'Ya no esperas ser rescatado. La isla se ha convertido en tu hogar.'
            : nextGame.endingType === 'RAFT_ESCAPE'
              ? 'Has logrado alcanzar tierra firme.'
              : nextGame.endingType === 'EMERGENCY_RADIO'
                ? 'El rescate ha llegado gracias a la radio de emergencia.'
                : 'Un barco ha visto tu señal.',
        stats: this.finalStats(nextGame),
      });
      return true;
    }

    if (nextGame.isGameOver && !wasGameOver) {
      this.importantModal.set({
        kind: 'game-over',
        eyebrow: 'Game over',
        title: 'No has sobrevivido',
        body: `Tu aventura terminó en el día ${nextGame.day}.`,
      });
      return true;
    }

    return false;
  }

  private finalStats(game: Game): Array<{ label: string; value: string | number }> {
    const resourceCount = game.inventoryItems.reduce(
      (total, item) => total + Math.max(0, item.quantity),
      0,
    );

    return [
      { label: 'Final conseguido', value: game.endingTitle ?? 'Rescate clásico' },
      { label: 'Días sobrevividos', value: game.day },
      { label: 'Recursos disponibles', value: resourceCount },
      { label: 'Eventos superados', value: game.narrativeEvents.length },
      { label: 'Construcciones realizadas', value: game.builtStructures.length },
    ];
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
