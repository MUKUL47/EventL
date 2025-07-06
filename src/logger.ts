export class Logger {
  private suppressWarnings: boolean = false;
  private supressErrors: boolean = false;

  constructor(
    options?: Partial<{ suppressWarnings: boolean; supressErrors: boolean }>
  ) {
    const { suppressWarnings, supressErrors } = options ?? {};
    this.suppressWarnings = !!suppressWarnings;
    this.supressErrors = !!supressErrors;
  }

  warn(message: string): void {
    if (this.suppressWarnings) return;
    console.warn(message);
  }

  throw(message: string): void {
    if (this.supressErrors) return;
    throw new Error(message);
  }
}
