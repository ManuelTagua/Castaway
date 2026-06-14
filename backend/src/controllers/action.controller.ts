import { Request, Response } from 'express';

import { isExploreZone, isGameAction, performGameAction } from '../services/action.service.js';

export async function performActionController(request: Request, response: Response) {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const action = request.body?.action;

    if (!id) {
      response.status(400).json({
        message: 'Game id is required',
      });
      return;
    }

    if (!isGameAction(action)) {
      response.status(400).json({
        message: 'Invalid action',
      });
      return;
    }

    const zone = request.body?.zone ?? null;

    if (action === 'EXPLORE' && zone !== null && !isExploreZone(zone)) {
      response.status(400).json({
        message: 'Invalid exploration zone',
      });
      return;
    }

    const result = await performGameAction(id, action, action === 'EXPLORE' ? zone : null);

    if (result.status === 'not_found') {
      response.status(404).json({
        message: 'Game not found',
      });
      return;
    }

    if (result.status === 'game_over') {
      response.status(400).json({
        message: 'Game is over',
      });
      return;
    }

    if (result.status === 'no_actions_remaining') {
      response.status(400).json({
        message: 'No actions remaining',
      });
      return;
    }

    if (result.status === 'missing_tool') {
      response.status(400).json({
        message: 'Required tool is missing',
      });
      return;
    }

    if (result.status === 'zone_not_discovered') {
      response.status(400).json({
        message: 'Zone is not discovered',
      });
      return;
    }

    response.json({
      game: result.game,
      message: result.message,
    });
  } catch (error) {
    response.status(500).json({
      message: 'Could not perform action',
    });
  }
}
