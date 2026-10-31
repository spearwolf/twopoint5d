import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {decidePublish, describePublishFailure, isDevelopmentVersion} from './publishDecision.mjs';

const FIRST_PUBLISH = 'oh it looks like this is the first time to publish the package';

describe('isDevelopmentVersion()', () => {
  it('marks a version that ends in -dev', () => {
    assert.equal(isDevelopmentVersion('0.25.0-dev'), true);
  });

  it('leaves a release and other pre-releases alone', () => {
    assert.equal(isDevelopmentVersion('0.25.0'), false);
    assert.equal(isDevelopmentVersion('0.25.0-beta.1'), false);
    assert.equal(isDevelopmentVersion('0.25.0-dev.1'), false);
  });
});

describe('decidePublish()', () => {
  it('publishes a version the registry does not list yet', () => {
    assert.deepEqual(decidePublish('0.25.0', {error: null, stdout: '["0.23.0","0.24.0"]\n', stderr: ''}), {
      action: 'publish',
      versions: ['0.23.0', '0.24.0'],
    });
  });

  it('skips a version the registry lists already', () => {
    assert.deepEqual(decidePublish('0.24.0', {error: null, stdout: '["0.23.0","0.24.0"]\n', stderr: ''}), {
      action: 'skip',
      message: 'skip publishing, version 0.24.0 is already released',
      versions: ['0.23.0', '0.24.0'],
    });
  });

  it('skips a version that is the one bare string npm answers with', () => {
    assert.deepEqual(decidePublish('0.24.0', {error: null, stdout: '"0.24.0"\n', stderr: ''}), {
      action: 'skip',
      message: 'skip publishing, version 0.24.0 is already released',
      versions: ['0.24.0'],
    });
  });

  it('fails on an empty answer', () => {
    const decision = decidePublish('0.25.0', {error: null, stdout: '', stderr: ''});
    assert.equal(decision.action, 'fail');
    assert.match(decision.message, /^npm show printed no version list: /);
  });

  it('fails on an answer that is no JSON', () => {
    const decision = decidePublish('0.25.0', {error: null, stdout: 'npm notice …', stderr: ''});
    assert.equal(decision.action, 'fail');
    assert.match(decision.message, /^npm show printed no version list: /);
  });

  it('publishes for the first time on E404 in the current npm wording', () => {
    const stderr = 'npm error code E404\nnpm error 404 Not Found - GET …\n';
    assert.deepEqual(decidePublish('0.25.0', {error: new Error('Command failed'), stdout: '', stderr}), {
      action: 'publish',
      message: FIRST_PUBLISH,
    });
  });

  it('publishes for the first time on E404 in the older npm wording', () => {
    assert.deepEqual(decidePublish('0.25.0', {error: new Error('Command failed'), stdout: '', stderr: 'npm ERR! code E404\n'}), {
      action: 'publish',
      message: FIRST_PUBLISH,
    });
  });

  it('fails on a timeout even when npm wrote an E404 before it was killed', () => {
    const error = Object.assign(new Error('spawnSync npm ETIMEDOUT'), {killed: true});
    assert.deepEqual(decidePublish('0.25.0', {error, stdout: '', stderr: 'npm error code E404\n'}), {
      action: 'fail',
      message: 'npm show did not answer within 60 s',
    });
  });

  it('fails on a timeout with nothing on stderr', () => {
    const error = Object.assign(new Error('timed out'), {killed: true});
    assert.deepEqual(decidePublish('0.25.0', {error, stdout: '', stderr: ''}), {
      action: 'fail',
      message: 'npm show did not answer within 60 s',
    });
  });

  it('fails with the reason npm gave on stderr', () => {
    assert.deepEqual(decidePublish('0.25.0', {error: new Error('Command failed'), stdout: '', stderr: 'npm error code E401\n'}), {
      action: 'fail',
      message: 'npm show failed: npm error code E401',
    });
  });

  it('fails with the message of the error when npm could not be started', () => {
    assert.deepEqual(decidePublish('0.25.0', {error: new Error('spawn npm ENOENT'), stdout: '', stderr: ''}), {
      action: 'fail',
      message: 'npm show failed: spawn npm ENOENT',
    });
  });
});

describe('describePublishFailure()', () => {
  it('names the exit code of npm', () => {
    assert.equal(
      describePublishFailure(Object.assign(new Error('Command failed'), {status: 1})),
      'npm publish failed: exit code 1',
    );
  });

  it('names the message when npm never ran', () => {
    assert.equal(
      describePublishFailure(Object.assign(new Error('Command failed'), {status: null})),
      'npm publish failed: Command failed',
    );
  });
});
