import { Routes } from '@angular/router';

import { GamePage } from './pages/game/game.page';
import { HomePage } from './pages/home/home.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
  {
    path: 'game/:id',
    component: GamePage,
  },
];
