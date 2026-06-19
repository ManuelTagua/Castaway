import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Game, GameDifficulty } from '../models/game.model';

export type GameAction =
  | 'FORAGE'
  | 'SEARCH_WATER'
  | 'REST'
  | 'EXPLORE'
  | 'FISH'
  | 'LEAVE_ISLAND'
  | 'SEND_RADIO_SIGNAL';
export type ExploreZone = 'BEACH' | 'JUNGLE' | 'CAVE' | 'CLIFFS';
export type StructureType =
  | 'CAMPFIRE'
  | 'FISHING_ROD'
  | 'BASIC_SHELTER'
  | 'WATER_COLLECTOR'
  | 'SIGNAL_FIRE'
  | 'STONE_KNIFE'
  | 'WOODEN_AXE'
  | 'LEAF_BASKET'
  | 'WATER_FILTER'
  | 'IMPROVED_SHELTER'
  | 'LARGE_WATER_COLLECTOR'
  | 'FIRST_AID_KIT'
  | 'IMPROVISED_RAFT'
  | 'REPAIRED_RADIO'
  | 'SIGNAL_MIRROR';

export type DecisionChoice =
  | 'OPEN'
  | 'IGNORE'
  | 'FOLLOW'
  | 'SCARE'
  | 'HIDE'
  | 'LEAVE'
  | 'EAT'
  | 'KEEP'
  | 'HELP'
  | 'INVESTIGATE'
  | 'STAY'
  | 'SEARCH';

export interface GameMutationResponse {
  game: Game;
  message: string;
  eventMessage?: string;
  eventMessages?: string[];
  importantEvent?: {
    title: string;
    message: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly gamesUrl = 'https://castaway-backend.onrender.com/api/games';

  constructor(private readonly http: HttpClient) {}

  createGame(difficulty: GameDifficulty): Observable<Game> {
    return this.http.post<Game>(this.gamesUrl, { difficulty });
  }

  getGames(): Observable<Game[]> {
    return this.http.get<Game[]>(this.gamesUrl);
  }

  getGameById(id: string): Observable<Game> {
    return this.http.get<Game>(`${this.gamesUrl}/${id}`);
  }

  performAction(
    id: string,
    action: GameAction,
    zone: ExploreZone | null = null,
  ): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/action`, { action, zone });
  }

  buildStructure(id: string, structure: StructureType): Observable<Game> {
    return this.http.post<Game>(`${this.gamesUrl}/${id}/build`, { structure });
  }

  eat(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/eat`, {});
  }

  drink(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/drink`, {});
  }

  eatCookedFish(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/eat-cooked-fish`, {});
  }

  eatCoconut(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/eat-coconut`, {});
  }

  cookFish(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/cook-fish`, {});
  }

  filterWater(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/filter-water`, {});
  }

  endDay(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/end-day`, {});
  }

  resolveDecision(id: string, choice: DecisionChoice): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/decision`, { choice });
  }

  useAntidote(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/use-antidote`, {});
  }

  useFirstAidKit(id: string): Observable<GameMutationResponse> {
    return this.http.post<GameMutationResponse>(`${this.gamesUrl}/${id}/use-first-aid-kit`, {});
  }
}
