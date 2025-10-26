#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// Get the list of nodes and credentials from package.json
const nodesInPackageJson = packageJson.n8n?.nodes || [];
const credentialsInPackageJson = packageJson.n8n?.credentials || [];

if (nodesInPackageJson.length === 0) {
	console.error('❌ No nodes found in package.json');
	process.exit(1);
}

if (credentialsInPackageJson.length === 0) {
	console.error('❌ No credentials found in package.json');
	process.exit(1);
}

console.log(`🔍 Validating ${nodesInPackageJson.length} nodes in package.json...`);
console.log(`🔍 Validating ${credentialsInPackageJson.length} credentials in package.json...`);

let hasErrors = false;

// ============================================================
// CHECK 1: All nodes in package.json exist in dist
// ============================================================
let missingNodes = [];
let foundNodes = [];

nodesInPackageJson.forEach((nodePath) => {
	const fullPath = path.join(__dirname, '..', nodePath);
	if (fs.existsSync(fullPath)) {
		foundNodes.push(nodePath);
	} else {
		missingNodes.push(nodePath);
	}
});

console.log(`✅ Found ${foundNodes.length} nodes in dist`);

if (missingNodes.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Missing ${missingNodes.length} node(s) in dist:`);
	missingNodes.forEach((node) => {
		console.error(`   - ${node}`);
	});
}

// ============================================================
// CHECK 2: All .node.js files in dist are listed in package.json
// ============================================================
console.log(`\n🔍 Checking for unlisted nodes in dist...`);

// Recursively find all .node.js files in dist/nodes
function findNodeFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			findNodeFiles(filePath, fileList);
		} else if (file.endsWith('.node.js') && !file.endsWith('.test.js')) {
			// Convert to relative path from project root
			const relativePath = path.relative(path.join(__dirname, '..'), filePath);
			fileList.push(relativePath);
		}
	});

	return fileList;
}

const distNodesPath = path.join(__dirname, '..', 'dist', 'nodes');

if (!fs.existsSync(distNodesPath)) {
	console.error(`\n❌ dist/nodes directory does not exist. Run build first.`);
	process.exit(1);
}

const nodesInDist = findNodeFiles(distNodesPath);

console.log(`📦 Found ${nodesInDist.length} .node.js files in dist`);

// Normalize paths for comparison (handle different path separators)
const normalizedPackageNodes = nodesInPackageJson.map(p => p.replace(/\\/g, '/'));
const normalizedDistNodes = nodesInDist.map(p => p.replace(/\\/g, '/'));

const unlistedNodes = normalizedDistNodes.filter(distNode =>
	!normalizedPackageNodes.includes(distNode)
);

if (unlistedNodes.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Found ${unlistedNodes.length} node(s) in dist that are not listed in package.json:`);
	unlistedNodes.forEach((node) => {
		console.error(`   - ${node}`);
	});
	console.error(`\n💡 Add these nodes to the "n8n.nodes" array in package.json`);
} else {
	console.log(`✅ All nodes in dist are listed in package.json`);
}

// ============================================================
// CHECK 3: All credentials in package.json exist in dist
// ============================================================
console.log(`\n🔍 Validating credentials in package.json...`);

let missingCredentials = [];
let foundCredentials = [];

credentialsInPackageJson.forEach((credPath) => {
	const fullPath = path.join(__dirname, '..', credPath);
	if (fs.existsSync(fullPath)) {
		foundCredentials.push(credPath);
	} else {
		missingCredentials.push(credPath);
	}
});

console.log(`✅ Found ${foundCredentials.length} credentials in dist`);

if (missingCredentials.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Missing ${missingCredentials.length} credential(s) in dist:`);
	missingCredentials.forEach((cred) => {
		console.error(`   - ${cred}`);
	});
}

// ============================================================
// CHECK 4: All .credentials.js files in dist are listed in package.json
// ============================================================
console.log(`\n🔍 Checking for unlisted credentials in dist...`);

// Recursively find all .credentials.js files in dist/credentials
function findCredentialFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			findCredentialFiles(filePath, fileList);
		} else if (file.endsWith('.credentials.js') && !file.endsWith('.test.js')) {
			// Convert to relative path from project root
			const relativePath = path.relative(path.join(__dirname, '..'), filePath);
			fileList.push(relativePath);
		}
	});

	return fileList;
}

const distCredentialsPath = path.join(__dirname, '..', 'dist', 'credentials');

if (!fs.existsSync(distCredentialsPath)) {
	console.error(`\n❌ dist/credentials directory does not exist. Run build first.`);
	process.exit(1);
}

const credentialsInDist = findCredentialFiles(distCredentialsPath);

console.log(`📦 Found ${credentialsInDist.length} .credentials.js files in dist`);

// Normalize paths for comparison (handle different path separators)
const normalizedPackageCredentials = credentialsInPackageJson.map(p => p.replace(/\\/g, '/'));
const normalizedDistCredentials = credentialsInDist.map(p => p.replace(/\\/g, '/'));

const unlistedCredentials = normalizedDistCredentials.filter(distCred =>
	!normalizedPackageCredentials.includes(distCred)
);

if (unlistedCredentials.length > 0) {
	hasErrors = true;
	console.error(`\n❌ Found ${unlistedCredentials.length} credential(s) in dist that are not listed in package.json:`);
	unlistedCredentials.forEach((cred) => {
		console.error(`   - ${cred}`);
	});
	console.error(`\n💡 Add these credentials to the "n8n.credentials" array in package.json`);
} else {
	console.log(`✅ All credentials in dist are listed in package.json`);
}

// ============================================================
// Final result
// ============================================================
if (hasErrors) {
	console.error(`\n❌ Validation failed!`);
	process.exit(1);
}

console.log(`\n✅ All validations passed!`);
process.exit(0);

