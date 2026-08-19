import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetail = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resObj = exception.getResponse() as any;
      message = typeof resObj === 'string' ? resObj : resObj.message || message;
      errorDetail = typeof resObj === 'object' ? resObj.error || errorDetail : errorDetail;
    } else {
      // Unhandled Exceptions (like Database down, Redis connection failure, etc.)
      const err = exception as any;
      this.logger.error(`Unhandled Exception Caught: ${err.message}`, err.stack);

      // Mask raw database connection traces to prevent credential exposure (security.md Section 7)
      if (err.code === 'ECONNREFUSED' || err.message?.includes('connect') || err.message?.includes('Database')) {
        message = 'Database service is currently unavailable. Please try again later.';
        errorDetail = 'Database Connection Failure';
      }
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message, // Standardize validation arrays
      error: errorDetail,
      timestamp: new Date().toISOString(),
    });
  }
}
