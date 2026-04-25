/**
 * IntellMatch Project Matching Engine — Main Entry
 *
 * Network-scoped counterpart matching for projects.
 *
 * @module project-matching
 */

export * from "./matching-bands.constants";
export * from "../../../external/projects/project-matching.types";
export * from "../../../external/projects/project-scoring.utils";
export * from "../../../external/projects/project-normalization.utils";
export * from "../../../external/projects/project-ontology.constants";
export { retrieveProjectCandidates } from "../../../external/projects/project-retrieval.utils";
export { ProjectMatchingService } from "../../../external/projects/project-matching.service";
export { ProjectLLMService } from "../../../external/projects/project-llm.service";
export {
  ProjectMatchingController,
  createProjectMatchingController,
  createProjectMatchingRoutes,
} from "../../../external/projects/project-matching.controller";
export {
  ProjectMatchingWorker,
  createProjectMatchingWorker,
} from "../../../external/projects/project-matching.worker";

export const PROJECT_ENGINE_VERSION = "2.0.0";
