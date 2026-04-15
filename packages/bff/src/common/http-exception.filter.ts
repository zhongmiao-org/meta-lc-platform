import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (error instanceof HttpException) {
      response.status(error.getStatus()).json({
        error: error.message,
        statusCode: error.getStatus()
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    });
  }
}
