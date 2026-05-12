import { ProjectMatchingService } from './project-matching.service';
import { ProjectMatchingJobPayload } from './project-matching.types';

export class ProjectMatchingWorker {
  constructor(private readonly service: ProjectMatchingService) {}

  async handle(job: { data: ProjectMatchingJobPayload }): Promise<any> {
    const payload = job.data;
    return this.service.findMatches({ userId: payload.userId || "" }, {
      projectId: payload.projectId,
      intent: payload.intent,
      filters: payload.filters,
      includeAI: payload.includeAI,
      includeExplanations: payload.includeExplanations,
    });
  }
}

