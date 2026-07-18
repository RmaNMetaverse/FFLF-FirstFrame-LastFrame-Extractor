const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('--- Git Commit & Build Automation ---');
  
  // Check if git is initialized
  if (!fs.existsSync('.git')) {
    console.log('Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });
  }

  // Stage changes
  console.log('Staging files...');
  execSync('git add .', { stdio: 'inherit' });

  // Check if there are changes to commit
  const status = execSync('git status --porcelain').toString().trim();
  if (!status) {
    console.log('No changes detected since last commit. Proceeding straight to build...');
  } else {
    // Commit changes
    const commitMsg = process.argv[2] || `Auto-commit build: ${new Date().toISOString()}`;
    console.log(`Committing changes with message: "${commitMsg}"`);
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
  }

  // Run electron-builder
  console.log('Building standalone Windows application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\nSUCCESS: Standalone executable created in /dist!');
} catch (error) {
  console.error('\nERROR: Commit-Build process failed.', error.message);
  process.exit(1);
}
