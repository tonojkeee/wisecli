#!/bin/bash
# WiseCLI start script with GPU handling

export NPM_CONFIG_NO_SCRIPTS=true

# Check for display
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
    echo "No display detected. Please run in a graphical environment."
    exit 1
fi

# GPU handling
if [ "$ENABLE_GPU" != "1" ]; then
    echo "Running with GPU disabled (set ENABLE_GPU=1 to enable)"
    export ELECTRON_DISABLE_GPU=1
fi

# Run the app
pnpm run dev
