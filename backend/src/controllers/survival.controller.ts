import { Request, Response } from 'express';

import {
  consumeResource,
  consumeSpecialResource,
  endDay,
  SurvivalResult,
  transformResource,
} from '../services/survival.service.js';

function getGameId(request: Request) {
  return Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
}

function sendSurvivalResult(result: SurvivalResult, response: Response) {
  if (result.status === 'not_found') {
    response.status(404).json({ message: 'Game not found' });
    return;
  }

  if (result.status === 'game_over') {
    response.status(400).json({ message: 'Game is over' });
    return;
  }

  if (result.status === 'insufficient_resource') {
    response.status(400).json({ message: 'Insufficient resource' });
    return;
  }

  if (result.status === 'missing_structure') {
    response.status(400).json({ message: 'Required structure is missing' });
    return;
  }

  response.json({
    game: result.game,
    message: result.message,
    eventMessage: result.eventMessage,
    eventMessages: result.eventMessages,
  });
}

export async function eatController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await consumeResource(id, 'FOOD');
  sendSurvivalResult(result, response);
}

export async function drinkController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await consumeResource(id, 'WATER');
  sendSurvivalResult(result, response);
}

export async function endDayController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await endDay(id);
  sendSurvivalResult(result, response);
}

export async function cookFishController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await transformResource(id, 'COOK_FISH');
  sendSurvivalResult(result, response);
}

export async function filterWaterController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await transformResource(id, 'FILTER_WATER');
  sendSurvivalResult(result, response);
}

export async function eatCoconutController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await consumeSpecialResource(id, 'COCONUT');
  sendSurvivalResult(result, response);
}

export async function eatCookedFishController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await consumeSpecialResource(id, 'COOKED_FISH');
  sendSurvivalResult(result, response);
}
