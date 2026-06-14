import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { GameService } from '../../services/game.service';
import { HealthService } from '../../services/health.service';
import { GameDifficulty } from '../../models/game.model';

type BackendStatus = 'checking' | 'connected' | 'offline';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  protected readonly backendStatus = signal<BackendStatus>('checking');
  protected readonly backendMessage = signal('Comprobando conexion con el backend...');
  protected readonly isCreatingGame = signal(false);
  protected readonly createGameError = signal('');
  protected readonly selectedDifficulty = signal<GameDifficulty>('NORMAL');

  constructor(
    private readonly gameService: GameService,
    private readonly healthService: HealthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.healthService.checkBackend().subscribe({
      next: (response) => {
        this.backendStatus.set('connected');
        this.backendMessage.set(response.message);
      },
      error: () => {
        this.backendStatus.set('offline');
        this.backendMessage.set('Backend no conectado');
      },
    });
  }

  protected startNewGame(): void {
    this.isCreatingGame.set(true);
    this.createGameError.set('');

    this.gameService.createGame(this.selectedDifficulty()).subscribe({
      next: (game) => {
        this.router.navigate(['/game', game.id]);
      },
      error: () => {
        this.isCreatingGame.set(false);
        this.createGameError.set('No se pudo crear la partida');
      },
    });
  }

  protected selectDifficulty(difficulty: GameDifficulty): void {
    this.selectedDifficulty.set(difficulty);
  }
}
