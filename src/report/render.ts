import type {
  DeathCause,
  Scorecard,
  Strategy,
  StyleName,
} from '../contracts.ts';

const STYLE_LABELS: Record<StyleName, string> = {
  conservative: '稳健型',
  aggressive: '激进型',
  trend: '趋势型',
};

const CAUSE_LABELS: Record<DeathCause, string> = {
  liquidation: '强制清算',
  'drawdown-breach': '回撤击穿',
  'stop-loss-bleed': '震荡止损放血',
  survived: '存活',
};

const percent = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

const signedPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${percent(value)}`;

export function renderScorecard(
  scorecard: Scorecard,
  strategy: Strategy,
): string {
  const lines: string[] = [
    `# 策略体检报告：${strategy.name}`,
    '',
    `> 场景集：\`${scorecard.scenarioSetId}\`，治疗集与 held-out 验证集使用不同 seed。`,
    '',
    '## 五维压力覆盖',
    '| 维度 | Skill | 数据时间 | 严重度 | shock | PnL | 最大回撤 | 交易 | damage | 结果 |',
    '|---|---|---|---:|---|---:|---:|---:|---:|---|',
  ];

  for (const evaluation of scorecard.evaluations) {
    lines.push(
      `| ${evaluation.dimension} | ${evaluation.sourceSkill} | ${evaluation.sourceObservedAt ?? '-'} | ${evaluation.severity} | ${evaluation.shock.kind} | ${percent(evaluation.metrics.pnlPct)} | ${percent(evaluation.metrics.maxDrawdownPct)} | ${evaluation.metrics.numTrades} | ${evaluation.damageScore.toFixed(1)} | ${CAUSE_LABELS[evaluation.cause]} |`,
    );
  }

  lines.push(
    '',
    '## 三风格评分',
    '| 风格 | 风险分 | 达标 | 最差回撤 | 平均收益 |',
    '|---|---:|---|---:|---:|',
  );

  for (const score of Object.values(scorecard.perStyle)) {
    lines.push(
      `| ${STYLE_LABELS[score.style]} | ${score.riskScore} | ${score.survived ? '是' : '否'} | ${percent(score.worstDrawdownPct)} | ${percent(score.meanPnlPct)} |`,
    );
  }

  lines.push('', '## 死因清单');
  if (scorecard.deaths.length === 0) {
    lines.push('当前治疗场景未发现致死结果。');
  } else {
    for (const death of scorecard.deaths) {
      lines.push(
        `- **${death.scenarioName}**（${death.dimension}）：${CAUSE_LABELS[death.cause]}；收益 ${percent(death.metrics.pnlPct)}，最大回撤 ${percent(death.metrics.maxDrawdownPct)}，交易 ${death.metrics.numTrades} 次。`,
        `  - ${death.narrative}`,
      );
    }
  }

  if (scorecard.prescription) {
    lines.push(
      '',
      '## 处方',
      `- 参数修改：\`${JSON.stringify(scorecard.prescription.changes)}\``,
      `- 修改依据：${scorecard.prescription.rationale}`,
    );
  }

  if (scorecard.tradeoff) {
    lines.push(
      '',
      '## held-out 复测（诚实取舍）',
      `- 风险分变化：${scorecard.tradeoff.robustnessGain >= 0 ? '+' : ''}${scorecard.tradeoff.robustnessGain}`,
      `- 平均收益变化：${signedPercent(scorecard.tradeoff.returnCost)}`,
    );
  }

  lines.push(
    '',
    '> 本报告不承诺“一键变好”。处方效果以未参与治疗的 held-out 场景结果为准，未达标项仍应保留为风险。',
  );

  return lines.join('\n');
}
