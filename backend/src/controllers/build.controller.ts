import { Request, Response } from 'express';

import { buildStructure, isStructureType } from '../services/build.service.js';

export async function buildStructureController(request: Request, response: Response) {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const structure = request.body?.structure;

    if (!id) {
      response.status(400).json({
        message: 'Game id is required',
      });
      return;
    }

    if (!isStructureType(structure)) {
      response.status(400).json({
        message: 'Invalid structure',
      });
      return;
    }

    const result = await buildStructure(id, structure);

    if (result.status === 'not_found') {
      response.status(404).json({
        message: 'Game not found',
      });
      return;
    }

    if (result.status === 'already_built') {
      response.status(409).json({
        message: 'Structure already built',
      });
      return;
    }

    if (result.status === 'game_over') {
      response.status(400).json({
        message: 'Game is over',
      });
      return;
    }

    if (result.status === 'insufficient_resources') {
      response.status(400).json({
        message: 'Insufficient resources',
      });
      return;
    }

    if (result.status === 'missing_requirements') {
      response.status(400).json({
        message: 'Missing structure requirements',
      });
      return;
    }

    response.status(201).json(result.game);
  } catch (error) {
    response.status(500).json({
      message: 'Could not build structure',
    });
  }
}
