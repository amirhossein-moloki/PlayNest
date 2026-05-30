import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFunction<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * A wrapper for asynchronous Express request handlers.
 * It catches any errors and passes them to the next middleware (error handler).
 *
 * Using RequestHandler<any, any, any, any> as the return type ensures
 * compatibility with router methods (get, post, etc.) while allowing
 * the use of custom request types like AppRequest in controllers.
 */
export const asyncHandler = <T extends Request = Request>(
  execution: AsyncFunction<T>
): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
    execution(req as T, res, next).catch(next);
  };
