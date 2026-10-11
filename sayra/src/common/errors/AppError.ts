type AppErrorOptions = {
  code?: string;
  details?: unknown;
  isOperational?: boolean;
};

class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, options: AppErrorOptions | boolean = true) {
    super(message);
    this.statusCode = statusCode;

    if (typeof options === 'boolean') {
      this.isOperational = options;
    } else {
      this.isOperational = options.isOperational ?? true;
      this.code = options.code;
      this.details = options.details;
    }

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
