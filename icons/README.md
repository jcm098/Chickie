# Chicken Tracker Icons

This folder contains the icon assets for the Chicken Tracker PWA.

## Files

- `icon-192.svg` - Standard 192x192 app icon
- `icon-512.svg` - Standard 512x512 app icon
- `icon-maskable-192.svg` - Maskable 192x192 app icon (for adaptive icons)
- `eggs-icon.svg` - Icon for the "Log Eggs" shortcut
- `settings-icon.svg` - Icon for the "Settings" shortcut

## PNG Versions

To create PNG versions of these icons, you can use any image editor or online converter:

```bash
# Example using ImageMagick (if installed):
convert icon-192.svg icon-192.png
convert icon-512.svg icon-512.png
convert icon-maskable-192.svg icon-maskable-192.png
```

Or use online tools like:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

## Usage

These icons are referenced in `manifest.json` for PWA installation and app shortcuts.