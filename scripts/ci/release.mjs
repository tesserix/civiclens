import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function submissionConfig(config, appId, ref) {
  if (!/^[0-9]{6,20}$/.test(appId || '') || ref !== 'refs/heads/main') {
    throw new Error('TestFlight requires main and CivicLens’s numeric App Store Connect app ID.');
  }
  return { ...config, submit: { ...config.submit, production: { ...config.submit?.production,
    ios: { ...config.submit?.production?.ios, ascAppId: appId } } } };
}

export function completedIosBuild(builds) {
  if (!Array.isArray(builds) || builds.length !== 1 || builds[0].platform !== 'IOS' ||
    builds[0].status !== 'FINISHED' || !/^[a-f0-9-]{36}$/.test(builds[0].id || '')) {
    throw new Error('Expected exactly one completed iOS build from this release.');
  }
  return builds[0].id;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'configure') {
    const config = JSON.parse(fs.readFileSync('eas.json','utf8'));
    fs.writeFileSync('eas.json',`${JSON.stringify(submissionConfig(config,process.env.CIVICLENS_ASC_APP_ID,process.env.GITHUB_REF),null,2)}\n`);
  } else if (process.argv[2] === 'build-id') {
    process.stdout.write(completedIosBuild(JSON.parse(fs.readFileSync(process.argv[3],'utf8'))));
  } else throw new Error('Expected configure or build-id.');
}
