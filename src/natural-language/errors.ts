export type DescriptionParseCode =
  | 'AMBIGUOUS_DESCRIPTION'
  | 'UNSUPPORTED_STRATEGY_DESCRIPTION';

export class DescriptionParseError extends Error {
  readonly code: DescriptionParseCode;
  readonly aiFallbackAllowed: boolean;

  constructor(
    code: DescriptionParseCode,
    message: string,
    aiFallbackAllowed = false,
  ) {
    super(message);
    this.name = 'DescriptionParseError';
    this.code = code;
    this.aiFallbackAllowed = aiFallbackAllowed;
  }
}
