# prescribe

- `mutations.ts`: maps death causes to deterministic parameter patch suggestions.
- `evolve.ts`: searches near-neighbor candidates for targeted causes; prioritizes survival, risk score, liquidation count, drawdown, and return.
- `validate.ts`: runs both original and patched strategies on independent held-out scenarios.

A prescription only changes `Strategy.params`; it does not change `archetype`, `universe`, or `timeframe`.