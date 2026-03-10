import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco to use locally bundled version
// This must be imported before any Editor component is rendered
loader.config({ monaco })

// Export the loader for reference
export { loader }
