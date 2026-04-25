import { Request, Response } from 'express';
import { ProjectMatchingService } from './project-matching.service';
import { FindProjectMatchesRequest } from './project-matching.types';

export class ProjectMatchingController {
  constructor(private readonly service: ProjectMatchingService) {}

  findMatches = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as FindProjectMatchesRequest;
      const result = await this.service.findMatches({ userId: (req as any).user?.id || "" }, body);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error?.message || 'Failed to find project matches',
      });
    }
  };
}

