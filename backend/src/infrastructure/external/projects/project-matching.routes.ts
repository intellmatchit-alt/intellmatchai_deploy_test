import { Router } from 'express';
import { ProjectMatchingController } from './project-matching.controller';

export function createProjectMatchingRouter(controller: ProjectMatchingController): Router {
  const router = Router();
  router.post('/find-matches', controller.findMatches);
  return router;
}
