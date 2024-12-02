const fs = require('fs');
const path = require('path');
const distDir = path.join(__dirname, '../dist');
const buildDir = path.join(__dirname, '../build');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}
