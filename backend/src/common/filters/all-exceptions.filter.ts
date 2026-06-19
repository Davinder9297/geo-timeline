import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const excRes = exception.getResponse();
      if (typeof excRes === 'string') {
        message = excRes;
      } else if (typeof excRes === 'object' && excRes !== null) {
        // Nest often uses { statusCode, message, error }
        // message can be string or array
        // @ts-ignore
        message = excRes.message || excRes['error'] || message;
        // @ts-ignore
        error = excRes['error'] || error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Log server errors
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception', exception as any);
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        error,
      },
    });
  }
}
