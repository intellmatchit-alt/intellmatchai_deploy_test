import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
