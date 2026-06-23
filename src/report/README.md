# Report Rendering

`renderScorecard(card, strategy)` emits the CLI Markdown report:

- five-dimension stress coverage, including survivors;
- three profile scores;
- deaths and scenario narratives;
- parameter prescription;
- held-out robustness and average return changes;
- an explicit statement that prescriptions do not guarantee future improvement.

Structured output is available through the CLI `--format json` option.
