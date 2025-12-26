import { execSync } from 'child_process';

import { createInterface } from 'readline';

const DRY_RUN = process.argv.includes('--dry-run');

function run(command, options = {}) {
  console.log(`> ${command}`);
  if (DRY_RUN && !options.alwaysRun) {
    return '';
  }
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options,
    }).trim();
  } catch (error) {
    if (options.ignoreError) return null;
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    process.exit(1);
  }
}

function getPublishedVersions() {
  try {
    const json = run('npm view hyntx versions --json', {
      alwaysRun: true,
      ignoreError: true,
    });
    if (!json) {
      console.warn(
        "WARNING: Could not fetch published versions. Assuming ['0.0.1'] based on user report.",
      );
      return ['0.0.1'];
    }
    // npm view returns a string if there's only one version, or an array if multiple
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.warn(
      "Could not parse npm versions, assuming ['0.0.1']:",
      e.message,
    );
    return ['0.0.1'];
  }
}

function getGitTags() {
  const tags = run('git tag --list', { alwaysRun: true })
    .split('\n')
    .filter(Boolean);
  return tags;
}

// Simple semver sort
function sortVersions(versions) {
  return versions.sort((a, b) => {
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');
    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (partsA[i] > partsB[i]) return 1;
      if (partsA[i] < partsB[i]) return -1;
    }
    return 0;
  });
}

function askOtp() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter OTP code (leave empty if not needed): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const currentBranch = run('git branch --show-current', { alwaysRun: true });

  try {
    const otp = await askOtp();

    console.log('Fetching published versions...');
    const publishedVersions = getPublishedVersions();
    console.log('Published versions:', publishedVersions);

    console.log('Fetching git tags...');
    const gitTags = getGitTags();

    // Filter tags that look like versions (vX.Y.Z or X.Y.Z)
    const versionTags = gitTags.filter((t) => /^v?\d+\.\d+\.\d+$/.test(t));

    // Find missing versions
    const pendingTags = versionTags.filter((tag) => {
      const version = tag.replace(/^v/, '');
      return !publishedVersions.includes(version);
    });

    if (pendingTags.length === 0) {
      console.log(
        'No pending versions found. All tags utilize published versions.',
      );
      return;
    }

    const sortedPendingTags = sortVersions(pendingTags);
    console.log('Pending versions to publish:', sortedPendingTags);

    if (DRY_RUN) {
      console.log('DRY RUN: skipping actual publish steps.');
    }

    for (const tag of sortedPendingTags) {
      console.log(`\nProcessing tag: ${tag}`);

      // Checkout tag
      run(`git checkout ${tag}`, { alwaysRun: !DRY_RUN });

      // Install dependencies (important if deps changed)
      run('pnpm install --frozen-lockfile', { ignoreError: true });

      // Build
      run('pnpm build');

      // Publish
      // Using --no-git-checks because we are in detached HEAD
      console.log(`Publishing ${tag}...`);
      const otpFlag = otp ? `--otp=${otp}` : '';
      run(`pnpm publish --no-git-checks --access public ${otpFlag}`);
    }

    console.log('\nAll done!');
  } finally {
    if (currentBranch) {
      console.log(`\nReturning to branch ${currentBranch}...`);
      run(`git checkout ${currentBranch}`, {
        alwaysRun: true,
        ignoreError: true,
      });
    }
  }
}

main();
