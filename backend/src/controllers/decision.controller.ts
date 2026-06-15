import { Request, Response } from 'express';

import {
  DecisionResult,
  isDecisionChoice,
  resolveDecision,
  useAntidote,
  useFirstAidKit,
} from '../services/decision.service.js';

function getGameId(request: Request) {
  return Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
}

function sendDecisionResult(result: DecisionResult, response: Response) {
  if (result.status === 'not_found') {
    response.status(404).json({ message: 'Game not found' });
    return;
  }

  if (result.status === 'game_over') {
    response.status(400).json({ message: 'Game is over' });
    return;
  }

  if (result.status === 'no_pending_decision') {
    response.status(400).json({ message: 'No pending decision' });
    return;
  }

  if (result.status === 'invalid_choice') {
    response.status(400).json({ message: 'Invalid choice' });
    return;
  }

  if (result.status === 'insufficient_resource') {
    response.status(400).json({ message: 'Insufficient resource' });
    return;
  }

  response.json({
    game: result.game,
    message: result.message,
    eventMessages: result.eventMessages,
    importantEvent: result.importantEvent,
  });
}

export async function resolveDecisionController(request: Request, response: Response) {
  const id = getGameId(request);
  const choice = request.body?.choice;

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  if (!isDecisionChoice(choice)) {
    response.status(400).json({ message: 'Invalid choice' });
    return;
  }

  const result = await resolveDecision(id, choice);
  sendDecisionResult(result, response);
}

export async function useAntidoteController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await useAntidote(id);
  sendDecisionResult(result, response);
}

export async function useFirstAidKitController(request: Request, response: Response) {
  const id = getGameId(request);

  if (!id) {
    response.status(400).json({ message: 'Game id is required' });
    return;
  }

  const result = await useFirstAidKit(id);
  sendDecisionResult(result, response);
}
