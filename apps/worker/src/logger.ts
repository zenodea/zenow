type Fields = Record<string, unknown>;

function emit(level: string, message: string, fields?: Fields): void {
  const line = { level, message, time: new Date().toISOString(), ...fields };
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

export const log = {
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
