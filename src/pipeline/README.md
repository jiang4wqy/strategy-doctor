# Diagnosis Pipeline

`runDoctor(strategy, backtest, options)` performs the end-to-end diagnosis:

1. Validate scenario IDs, dimensions, source skills, shocks, and treatment/held-out seeds.
2. Backtest the selected stress scenarios and build all evaluations.
3. Produce three profile scores and the death subset.
4. Generate failure-targeted prescriptions.
5. Score the original and patched strategy on independent held-out scenarios.

Even when no death is found, the pipeline returns a zero-change prescription and an explicit trade-off result.
