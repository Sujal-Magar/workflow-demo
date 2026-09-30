// Global Express augmentation: `requireAuth` sets the authenticated user id on the request.
declare namespace Express {
  interface Request {
    userId?: string;
  }
}
