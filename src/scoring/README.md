# scoring

`styles.ts` defines three profiles: `conservative`, `aggressive`, `trend`.

`scoreStyle(metrics, profile)` combines liquidation rate, non-liquidation drawdown, and mean return. It returns a 0-100 risk score. If a profile threshold fails, the style is not marked passed. Empty results are rejected.