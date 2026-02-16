console.log('process.type:', process.type)
console.log('process.versions.electron:', process.versions.electron)
console.log('process.versions.node:', process.versions.node)

try {
    const e = require('electron')
    console.log('typeof electron:', typeof e)
    console.log('electron keys:', typeof e === 'object' ? Object.keys(e) : e)
    console.log('electron.app:', e.app)
} catch (err) {
    console.error('Error requiring electron:', err.message)
}

// Try to quit gracefully after logging
setTimeout(() => process.exit(0), 1000)
