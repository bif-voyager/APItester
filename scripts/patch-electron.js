// scripts/patch-electron.js
// Postinstall script that patches node_modules/electron/index.js
// to fix a Windows bug where require('electron') resolves to the npm package
// instead of Electron's built-in module.
//
// Usage: Add to package.json scripts: "postinstall": "node scripts/patch-electron.js"

const fs = require('fs')
const path = require('path')

const electronIndexPath = path.join(__dirname, '..', 'node_modules', 'electron', 'index.js')

const patchedContent = `
const fs = require('fs');
const path = require('path');

const pathFile = path.join(__dirname, 'path.txt');

function getElectronPath () {
  let executablePath;
  if (fs.existsSync(pathFile)) {
    executablePath = fs.readFileSync(pathFile, 'utf-8');
  }
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    return path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, executablePath || 'electron');
  }
  if (executablePath) {
    return path.join(__dirname, 'dist', executablePath);
  } else {
    throw new Error('Electron failed to install correctly, please delete node_modules/electron and try installing again');
  }
}

// PATCH: When running inside the Electron runtime, the built-in 'electron'
// module should be used. We detect this via process.versions.electron.
// On Windows, Node's module resolution finds this npm package first,
// shadowing the built-in module. This patch fixes that.
if (process.versions && process.versions.electron) {
  // We're inside Electron runtime.
  // The built-in electron module is not directly accessible when the npm package
  // shadows it. However, Electron sets up its APIs on the process object.
  // We need to find the internal module and re-export it.
  
  // Method: Use Module._cache to bypass this file
  const Module = require('module');
  const thisFile = __filename;
  
  // Remove ourselves from the cache
  delete Module._cache[thisFile];
  
  // Delete this directory from module paths so require('electron') 
  // falls through to the built-in on next require
  const electronNpmDir = __dirname;
  const origFindPath = Module._findPath;
  Module._findPath = function(request, paths, isMain) {
    if (request === 'electron') {
      // Filter out paths that would resolve to this npm package
      const filteredPaths = paths ? paths.filter(p => !p.startsWith(electronNpmDir) && !p.includes('node_modules')) : paths;
      // Return false to indicate not found, so _load's built-in handler takes over
      return false;
    }
    return origFindPath.call(this, request, paths, isMain);
  };
  
  // Now re-require 'electron' - this should trigger Electron's built-in handler
  try {
    const builtinElectron = require('electron');
    if (typeof builtinElectron !== 'string' && builtinElectron.app) {
      // Success! Restore and export
      Module._findPath = origFindPath;
      module.exports = builtinElectron;
    } else {
      Module._findPath = origFindPath;
      module.exports = getElectronPath();
    }
  } catch(e) {
    Module._findPath = origFindPath;
    module.exports = getElectronPath();
  }
} else {
  module.exports = getElectronPath();
}
`

try {
    fs.writeFileSync(electronIndexPath, patchedContent, 'utf-8')
    console.log('✅ Patched node_modules/electron/index.js for Windows compatibility')
} catch (err) {
    console.error('⚠️ Failed to patch electron/index.js:', err.message)
}
