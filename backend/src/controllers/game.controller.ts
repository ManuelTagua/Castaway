import { Request, Response } from 'express';

import { createGame, getGameById, getGames, isGameDifficulty } from '../services/game.service.js';

export async function createGameController(request: Request, response: Response) {
  try {
    const difficulty = request.body?.difficulty ?? 'NORMAL';

    if (!isGameDifficulty(difficulty)) {
      response.status(400).json({
        message: 'Invalid difficulty',
      });
      return;
    }

    const game = await createGame(difficulty);
    response.status(201).json(game);
  } catch (error) {
    response.status(500).json({
      message: 'Could not create game',
    });
  }
}

export async function getGamesController(_request: Request, response: Response) {
  try {
    const games = await getGames();
    response.json(games);
  } catch (error) {
    response.status(500).json({
      message: 'Could not load games',
    });
  }
}

export async function getGameByIdController(request: Request, response: Response) {
  try {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

    if (!id) {
      response.status(400).json({
        message: 'Game id is required',
      });
      return;
    }

    const game = await getGameById(id);

    if (!game) {
      response.status(404).json({
        message: 'Game not found',
      });
      return;
    }

    response.json(game);
  } catch (error) {
    response.status(500).json({
      message: 'Could not load game',
    });
  }
}
