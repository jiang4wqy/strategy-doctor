# pipeline

`runDoctor(strategy, backtest, options)` runs the full diagnosis flow:

1. Validate strategy id, dimension, skill bindings, shock selection, and treatment/held-out seeds.
2. Backtest selected scenarios and produce all `evaluations`.
3. Build three-style scores and a `deaths` subset.
4. Build a targeted prescription.
5. Compute risk score and held-out trade-off.

If there are no deaths, it still returns a zero-change patch and a zero trade-off.