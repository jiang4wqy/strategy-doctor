# Prescription

- `mutations.ts` maps failure causes to deterministic parameter patch behavior.
- `evolve.ts` searches only failure-relevant parameters and ranks candidates by survival, risk score, liquidation count, drawdown, and return.
- `validate.ts` compares the original and patched strategy on independent held-out scenarios.

Prescriptions only modify `Strategy.params`; they never change archetype, universe, or timeframe.
