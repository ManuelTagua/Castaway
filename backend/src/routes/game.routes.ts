import { Router } from 'express';

import { performActionController } from '../controllers/action.controller.js';
import { buildStructureController } from '../controllers/build.controller.js';
import {
  cookFishController,
  drinkController,
  eatController,
  eatCoconutController,
  eatCookedFishController,
  endDayController,
  filterWaterController,
} from '../controllers/survival.controller.js';
import {
  createGameController,
  getGameByIdController,
  getGamesController,
} from '../controllers/game.controller.js';

export const gameRouter = Router();

gameRouter.post('/', createGameController);
gameRouter.get('/', getGamesController);
gameRouter.post('/:id/action', performActionController);
gameRouter.post('/:id/build', buildStructureController);
gameRouter.post('/:id/eat', eatController);
gameRouter.post('/:id/drink', drinkController);
gameRouter.post('/:id/eat-cooked-fish', eatCookedFishController);
gameRouter.post('/:id/eat-coconut', eatCoconutController);
gameRouter.post('/:id/cook-fish', cookFishController);
gameRouter.post('/:id/filter-water', filterWaterController);
gameRouter.post('/:id/end-day', endDayController);
gameRouter.get('/:id', getGameByIdController);
