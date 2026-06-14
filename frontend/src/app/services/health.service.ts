import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { HealthResponse } from '../models/health-response.model';

@Injectable({
  providedIn: 'root',
})
export class HealthService {
  private readonly healthUrl = 'http://localhost:3000/api/health';

  constructor(private readonly http: HttpClient) {}

  checkBackend(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(this.healthUrl);
  }
}
