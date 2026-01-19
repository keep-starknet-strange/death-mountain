#!/bin/bash

# Loot Survivor Native Shell Setup Script
# This script helps with initial setup of the native shell app

set -e

echo "🎮 Loot Survivor Native Shell Setup"
echo "===================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required"
    echo "   Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version OK: $(node -v)"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "   Install with: npm install -g pnpm"
    exit 1
fi
echo "✅ pnpm is installed: $(pnpm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install
echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please edit .env and set your configuration:"
    echo "   - EXPO_PUBLIC_NATIVE_WEB_URL"
    echo "   - EXPO_PUBLIC_ALLOWED_ORIGINS"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Check for assets
echo "🖼️  Checking assets..."
if [ ! -f assets/icon.png ]; then
    echo "⚠️  Warning: assets/icon.png not found"
    echo "   The app will run but won't have a custom icon"
    echo "   Copy from: ../../client/public/favicon.png"
    echo ""
fi

if [ ! -f assets/splash.png ]; then
    echo "⚠️  Warning: assets/splash.png not found"
    echo "   The app will run but won't have a custom splash screen"
    echo "   Copy from: ../../client/public/banner.png"
    echo ""
fi

# Check Expo CLI
if ! command -v expo &> /dev/null; then
    echo "📱 Installing Expo CLI globally..."
    npm install -g expo-cli
    echo "✅ Expo CLI installed"
    echo ""
else
    echo "✅ Expo CLI is installed"
    echo ""
fi

# Summary
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. (Optional) Add custom assets to assets/ folder"
echo "3. Run 'pnpm start' to start the development server"
echo "4. Press 'i' for iOS or 'a' for Android"
echo ""
echo "For more information, see:"
echo "- README.md for full documentation"
echo "- QUICKSTART.md for quick start guide"
echo ""
echo "Happy coding! 🚀"
