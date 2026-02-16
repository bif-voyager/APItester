#!/usr/bin/env node
// Launcher script that fixes the Windows module resolution bug
// where node_modules/electron/index.js shadows the built-in electron module.
// 
// This script temporarily renames the npm package's index.js before launching
// the Electron binary, ensuring require('electron') resolves to the built-in.

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const electronPkg = path.join(__dirname, 'node_modules', 'electron')
const indexPath = path.join(electronPkg, 'index.js')
const backupPath = path.join(electronPkg, '_index.js.bak')
const electronExe = path.join(electronPkg, 'dist', 'electron.exe')

// Step 1: Rename index.js to prevent it from being found
let renamed = false
if (fs.existsSync(indexPath)) {
    fs.renameSync(indexPath, backupPath)
    renamed = true
    console.log('[launcher] Renamed node_modules/electron/index.js to prevent shadowing')
}

// Step 2: Spawn the real Electron binary
const args = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['.']
const child = spawn(electronExe, args, {
    stdio: 'inherit',
    env: { ...process.env },
    windowsHide: false
})

// Step 3: Restore index.js when Electron exits
function restore() {
    if (renamed && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, indexPath)
        console.log('[launcher] Restored node_modules/electron/index.js')
    }
}

child.on('close', (code) => {
    restore()
    process.exit(code)
})

child.on('error', (err) => {
    console.error('[launcher] Error:', err)
    restore()
    process.exit(1)
})

// Handle parent process signals
process.on('SIGINT', () => { child.kill('SIGINT'); restore() })
process.on('SIGTERM', () => { child.kill('SIGTERM'); restore() })
process.on('exit', restore)
