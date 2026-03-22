export class CommandError extends Error {
  constructor(message, code = 'COMMAND_FAILED') {
    super(message);
    this.name = 'CommandError';
    this.code = code;
  }
}
