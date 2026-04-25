import { BaseError } from './index';

export class InsufficientPointsError extends BaseError {
  readonly statusCode = 402;
  readonly code = 'INSUFFICIENT_POINTS';

  constructor(needed: number, available: number) {
    super(`Insufficient points. Need ${needed}, have ${available}`, {
      needed,
      available,
    });
  }
}
