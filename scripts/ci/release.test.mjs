import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submissionConfig, completedIosBuild } from './release.mjs';

test('uses only the explicit CivicLens app ID on main and preserves other settings', () => {
  assert.deepEqual(submissionConfig({build:{production:{autoIncrement:true}}},'1234567890','refs/heads/main'),
    {build:{production:{autoIncrement:true}},submit:{production:{ios:{ascAppId:'1234567890'}}}});
  assert.throws(() => submissionConfig({},'','refs/heads/main'));
  assert.throws(() => submissionConfig({},'1234567890','refs/heads/other'));
});
test('submits the exact completed iOS build from this release', () => {
  const id='11111111-2222-4333-8444-555555555555';
  assert.equal(completedIosBuild([{id,platform:'IOS',status:'FINISHED'}]),id);
  assert.throws(() => completedIosBuild([{id,platform:'IOS',status:'IN_PROGRESS'}]));
  assert.throws(() => completedIosBuild([{id,platform:'ANDROID',status:'FINISHED'}]));
  assert.throws(() => completedIosBuild([]));
});
