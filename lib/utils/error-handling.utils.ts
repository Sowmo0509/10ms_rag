import { NextResponse } from "next/server";

export interface APIError {
  error: string;
  details?: string;
  errorType?: string;
}

export class APIErrorHandler {
  static handleError(error: unknown, context: string): NextResponse<APIError> {
    console.error(`❌ ${context} ERROR:`, error);
    console.error("Error name:", (error as Error).name);
    console.error("Error message:", (error as Error).message);
    console.error("Error stack:", (error as Error).stack);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorName = error instanceof Error ? error.name : "UnknownError";

    return NextResponse.json(
      {
        error: `Failed to ${context.toLowerCase()}`,
        details: errorMessage,
        errorType: errorName,
      },
      { status: 500 }
    );
  }

  static handleValidationError(message: string, status: number = 400): NextResponse<APIError> {
    return NextResponse.json({ error: message }, { status });
  }

  static handleMissingEnvironmentVariable(variable: string): NextResponse<APIError> {
    const message = `${variable} environment variable is not set`;
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export class Logger {
  static info(message: string, ...args: unknown[]): void {
    console.log(`ℹ️ ${message}`, ...args);
  }

  static success(message: string, ...args: unknown[]): void {
    console.log(`✅ ${message}`, ...args);
  }

  static warning(message: string, ...args: unknown[]): void {
    console.log(`⚠️ ${message}`, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`❌ ${message}`, ...args);
  }

  static debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 ${message}`, ...args);
    }
  }

  static progress(current: number, total: number, message: string): void {
    console.log(`📊 Progress: ${current}/${total} - ${message}`);
  }
}
