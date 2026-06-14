import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { gameRouter } from './routes/game.routes.js';
import { healthRouter } from './routes/health.routes.js';

dotenv.config();

export const app = express();

const allowedOrigins = (
  process.env.FRONTEND_URL ?? 'http://localhost:4200,http://127.0.0.1:4200'
).split(',');

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/games', gameRouter);
