const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

function log(level: LogLevel, message: string, meta?: unknown): void {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const currentLevel = envLevel ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
  if (LOG_LEVELS[level] > currentLevel) return;

  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
};
