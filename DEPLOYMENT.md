# PWA Installation Guide

## Important: HTTPS Requirement
**PWAs can only be installed on mobile devices when served over HTTPS.** Localhost (http://localhost) works for development, but mobile devices require HTTPS.

## Deployment Options

### Option 1: GitHub Pages (Free & Recommended)
1. Push your code to GitHub (already done)
2. Go to your repository settings
3. Navigate to Pages section
4. Select source: Deploy from a branch
5. Select branch: master
6. Click Save
7. Your app will be available at: `https://mrshovon.github.io/BakiTrackerV2/`

### Option 2: Netlify (Free)
1. Go to [netlify.com](https://netlify.com) and sign up
2. Drag and drop your Baki_Tracker folder to Netlify
3. Your app will be deployed instantly with HTTPS

### Option 3: Vercel (Free)
1. Go to [vercel.com](https://vercel.com) and sign up
2. Import your GitHub repository
3. Deploy with one click

### Option 4: Local HTTPS Server (For Testing)
If you want to test locally with HTTPS on your phone:

#### Using `http-server` with HTTPS:
```bash
# Install http-server globally
npm install -g http-server

# Generate SSL certificates (using mkcert)
# First install mkcert: https://github.com/FiloSottile/mkcert
mkcert -install
mkcert localhost 127.0.0.1

# Run with HTTPS
http-server -S -C cert.pem -K key.pem -p 8443
```

Then access from your phone using your computer's IP address:
`https://YOUR_IP:8443`

## Testing PWA Installation

After deploying to HTTPS:

1. **On Android (Chrome):**
   - Open the app in Chrome
   - Tap the menu (three dots)
   - Select "Add to Home screen" or "Install app"
   - The app will be installed on your home screen

2. **On iOS (Safari):**
   - Open the app in Safari
   - Tap the Share button
   - Select "Add to Home Screen"
   - The app will be installed on your home screen

## Troubleshooting

### App won't install:
- Ensure you're using HTTPS (not HTTP)
- Check that the manifest.json is accessible
- Check browser console for errors
- Ensure service worker is registered correctly

### Icons not showing:
- Clear browser cache and reload
- Ensure icon files are in the root directory
- Check manifest.json icon paths

### Service worker not working:
- Open DevTools > Application > Service Workers
- Check if service worker is active
- Unregister and refresh to re-register

## Current PWA Status
- ✅ Manifest.json configured
- ✅ Service worker registered
- ✅ Icons created (SVG format)
- ✅ Theme color set
- ✅ Display mode: standalone
- ⚠️ Requires HTTPS for mobile installation
