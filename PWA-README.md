# PWA Icon Generation

Your app now supports PWA installation! To complete the setup, you need to add PNG icons.

## Required Icons
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

## How to Generate Icons

### Option 1: Online Tools
1. Visit https://favicon.io/favicon-converter/
2. Upload your `public/favicon.svg`
3. Download the 192x192 and 512x512 PNG versions
4. Save them as `icon-192.png` and `icon-512.png` in the `public/` folder

### Option 2: Using Sharp (if installed)
```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

### Option 3: Manual Creation
Use any image editor (Photoshop, GIMP, etc.) to create PNG versions of your favicon at the required sizes.

## Testing PWA Installability
After adding the icons:
1. Deploy to Vercel: `vercel --prod`
2. Visit your site on mobile Chrome/Safari
3. Look for the "Add to Home Screen" option in the browser menu

The manifest.json is already configured with the correct icon references.