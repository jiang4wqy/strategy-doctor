# scoring

`styles.ts` 定义 conservative、aggressive、trend 三种 profile。

`scoreStyle(metrics, profile)` 结合清算比例、非清算场景回撤和平均收益，输出 0-100 风险分。未满足 profile 阈值时，分数不会显示成通过状态；空结果集会被拒绝。
