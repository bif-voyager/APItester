// Workaround for Windows bug: require('electron') resolves to the npm package 
// instead of the Electron built-in module. The npm package's index.js just 
// returns the path to the electron.exe binary.
//
// Fix: Delete the cached npm module entry and rename the npm package's index.js
// so it doesn't get found, allowing the built-in electron module to be loaded.
const path = require('path')
const fs = require('fs')

// Check if we need to apply the workaround
const testElectron = require('electron')
if (typeof testElectron === 'string') {
    // We got the exe path instead of the API — need to fix module resolution
    // Remove from require cache
    const electronIndexPath = require.resolve('electron')
    delete require.cache[electronIndexPath]

    // Temporarily rename the npm package's index.js
    const electronDir = path.dirname(electronIndexPath)
    const indexPath = path.join(electronDir, 'index.js')
    const backupPath = path.join(electronDir, 'index.js.bak')

    if (fs.existsSync(indexPath)) {
        fs.renameSync(indexPath, backupPath)
    }

    // Now require('electron') should find the built-in
    const electron = require('electron')

    // Restore the file
    if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, indexPath)
    }

    // Re-export
    module.exports = electron
    startApp(electron)
} else {
    startApp(testElectron)
}

function startApp(electron) {
    const { app, BrowserWindow } = electron

    let mainWindow

    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        })

        // In development, load from Vite dev server
        if (process.env.NODE_ENV === 'development') {
            mainWindow.loadURL('http://localhost:5173')
            mainWindow.webContents.openDevTools()
        } else {
            // In production, load the built files
            mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
        }

        mainWindow.setMenuBarVisibility(false)
    }

    app.whenReady().then(createWindow)

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
}
