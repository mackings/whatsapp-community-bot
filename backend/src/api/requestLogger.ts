import type { NextFunction, Request, Response } from "express";
import pino from "pino";

// Always prints, independent of LOG_LEVEL — this is the one log source we
// always want visible: every API call, success or failure.
export const apiLogger = pino({ level: "info" });

export function logApiCalls(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const entry = { method: req.method, path: req.originalUrl, status: res.statusCode, durationMs };

    if (res.statusCode >= 400) {
      apiLogger.error(entry, "API call failed");
    } else {
      apiLogger.info(entry, "API call succeeded");
    }
  });

  next();
}
