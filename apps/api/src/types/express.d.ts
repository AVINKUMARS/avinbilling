import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: Types.ObjectId;
        organizationId: Types.ObjectId;
        role: string;
        permissions: string[];
      };
    }
  }
}

export {};
