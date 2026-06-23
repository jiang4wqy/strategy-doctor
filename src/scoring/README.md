# Scoring

`styles.ts` defines the conservative, aggressive, and trend profiles.

`scoreStyle(metrics, profile)` combines liquidation count, non-liquidated drawdown, and mean return into a 0-100 risk score. A score is not treated as passing unless it satisfies the selected profile thresholds. Empty metric sets are rejected.
