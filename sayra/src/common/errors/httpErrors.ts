import AppError from './AppError';

export const badRequest = (message = 'Bad Request') => new AppError(message, 400);
export const unauthorized = (message = 'Unauthorized') => new AppError(message, 401);
export const forbidden = (message = 'Forbidden') => new AppError(message, 403);
export const notFound = (message = 'Not Found') => new AppError(message, 404);
export const conflict = (message = 'Conflict') => new AppError(message, 409);
export const internalServerError = (message = 'Internal Server Error') => new AppError(message, 500);
