import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubmissionPack,
  renderSubmissionPackMarkdown,
} from '../../src/scripts/submission-pack.ts';
import {
  diagnosisFixture,
  requestFixture,
} from '../../web/src/test/fixtures.ts';

test('submission pack turns diagnosis views into reviewer-ready evidence', () => {
  const pack = createSubmissionPack({
    generatedAt: '2026-06-23T00:00:00.000Z',
    seed: 42,
    candidates: 6,
    diagnoses: [{
      label: 'MA crossover',
      request: requestFixture,
      view: diagnosisFixture,
    }],
  });

  assert.equal(pack.version, 'submission-pack-v1');
  assert.equal(pack.project.track, 'Bitget AI Hackathon Track 2');
  assert.equal(pack.run.seed, 42);
  assert.equal(pack.strategies[0].label, 'MA crossover');
  assert.equal(pack.strategies[0].dimensions.length, 5);
  assert.equal(pack.readiness.fiveDimensionsCovered, true);
  assert.equal(pack.readiness.heldOutValidationPresent, true);
  assert.equal(typeof pack.evidenceHash, 'string');
  assert.equal(pack.evidenceHash.length, 64);
});

test('submission pack markdown is English and includes reproduction steps', () => {
  const pack = createSubmissionPack({
    generatedAt: '2026-06-23T00:00:00.000Z',
    seed: 42,
    candidates: 6,
    diagnoses: [{
      label: 'MA crossover',
      request: requestFixture,
      view: diagnosisFixture,
    }],
  });

  const markdown = renderSubmissionPackMarkdown(pack);

  assert.ok(markdown.includes('# Strategy Doctor submission evidence pack'));
  assert.ok(markdown.includes('Five-dimension coverage'));
  assert.ok(markdown.includes('Held-out validation'));
  assert.ok(markdown.includes('Reproduce locally'));
  assert.ok(!markdown.includes('涓'));
});
