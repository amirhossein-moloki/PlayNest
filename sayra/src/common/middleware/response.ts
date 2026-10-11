import { Request, Response, NextFunction } from 'express';
import * as responseUtils from '../utils/response';

export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  res.ok = function <T>(data: T, meta?: Omit<responseUtils.ApiMeta, 'requestId'>) {
    return responseUtils.sendOk(res, data, meta);
  };

  res.created = function <T>(data: T, meta?: Omit<responseUtils.ApiMeta, 'requestId'>) {
    return responseUtils.sendCreated(res, data, meta);
  };

  res.noContent = function () {
    return responseUtils.sendNoContent(res);
  };

  res.fail = function (
    code: string,
    message: string,
    status = 400,
    details?: unknown,
    meta?: Omit<responseUtils.ApiMeta, 'requestId'>
  ) {
    return responseUtils.sendFail(res, code, message, status, details, meta);
  };

  next();
}
