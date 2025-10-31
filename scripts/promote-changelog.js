#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');

function getVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  return packageJson.version;
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function promoteChangelog() {
  const version = getVersion();
  const date = getTodayDate();

  let changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');

  // Check if Unreleased section exists
  if (!changelog.includes('## [Unreleased]')) {
    console.error('Error: No [Unreleased] section found in CHANGELOG.md');
    process.exit(1);
  }

  // Check if version already exists
  if (changelog.includes(`## [${version}]`)) {
    console.error(`Error: Version [${version}] already exists in CHANGELOG.md`);
    process.exit(1);
  }

  // Replace [Unreleased] with the new version and date
  changelog = changelog.replace(
    '## [Unreleased]',
    `## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed\n\n### Removed\n\n## [${version}] - ${date}`
  );

  fs.writeFileSync(CHANGELOG_PATH, changelog, 'utf8');

  console.log(`✓ Promoted [Unreleased] to [${version}] - ${date}`);
  console.log(`✓ Created new [Unreleased] section`);
}

try {
  promoteChangelog();
} catch (error) {
  console.error('Error promoting changelog:', error.message);
  process.exit(1);
}
