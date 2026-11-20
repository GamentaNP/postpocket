import React from 'react'
import { createRoot } from 'react-dom/client'
import { installDemoRuntime } from './lib/demo-runtime'
import App from './App'
import '../ui/styles.css'
import './styles/app.css'

installDemoRuntime()
createRoot(document.getElementById('root')!).render(<App mode="dashboard" />)
