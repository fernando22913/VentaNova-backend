import type { TrendReport } from '../../domain/model/trends.js';
import type { TrendsRepository } from '../../domain/ports/trends-repository.js';

export interface GetTrendsDeps {
  trends: TrendsRepository;
}

export class GetTrends {
  constructor(private readonly deps: GetTrendsDeps) {}

  execute(): Promise<TrendReport> {
    return this.deps.trends.getReport();
  }
}