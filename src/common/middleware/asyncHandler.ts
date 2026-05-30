import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFunction<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler = <T extends Request = Request>(
  execution: AsyncFunction<T>
): RequestHandler => (req, res, next) => {
  execution(req as T, res, next).catch(next);
};