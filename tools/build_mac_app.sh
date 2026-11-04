#!/bin/zsh
set -e

PROJECT_DIR="/Users/danielvalencia/.gemini/antigravity/scratch/discover-canada-mac-app"
APP_BUNDLE="$PROJECT_DIR/Discover Canada Prep.app"

echo "1. Creating Universal macOS App Bundle structure..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/app"

cp "$PROJECT_DIR/macos/Info.plist" "$APP_BUNDLE/Contents/Info.plist"

echo "2. Compiling Universal Binary (arm64 + x86_64) for macOS 11.0+..."
clang -ObjC -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 \
      -framework Cocoa -framework WebKit \
      "$PROJECT_DIR/macos/main.m" \
      -o "$APP_BUNDLE/Contents/MacOS/DiscoverCanadaPrep"

chmod +x "$APP_BUNDLE/Contents/MacOS/DiscoverCanadaPrep"
file "$APP_BUNDLE/Contents/MacOS/DiscoverCanadaPrep"

echo "3. Generating Native macOS AppIcon.icns..."
ICONSET_DIR="/tmp/DiscoverCanada.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

cat << 'EOF' > /tmp/gen_icon.m
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

void writeIconSize(int px, NSString *outPath) {
    NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
        initWithBitmapDataPlanes:NULL
                      pixelsWide:px
                      pixelsHigh:px
                   bitsPerSample:8
                 samplesPerPixel:4
                        hasAlpha:YES
                        isPlanar:NO
                  colorSpaceName:NSDeviceRGBColorSpace
                     bytesPerRow:0
                    bitsPerPixel:0];
    [NSGraphicsContext saveGraphicsState];
    NSGraphicsContext *ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
    [NSGraphicsContext setCurrentContext:ctx];

    CGFloat pad = px * 0.08;
    NSRect rect = NSMakeRect(pad, pad, px - pad * 2, px - pad * 2);
    NSBezierPath *bg = [NSBezierPath bezierPathWithRoundedRect:rect xRadius:px * 0.22 yRadius:px * 0.22];
    [[NSColor colorWithSRGBRed:0.78 green:0.06 blue:0.18 alpha:1.0] setFill];
    [bg fill];

    NSRect inner = NSInsetRect(rect, px * 0.08, px * 0.08);
    NSBezierPath *inPath = [NSBezierPath bezierPathWithRoundedRect:inner xRadius:px * 0.14 yRadius:px * 0.14];
    [[NSColor whiteColor] setFill];
    [inPath fill];

    NSString *maple = @"🍁";
    NSDictionary *attrs = @{
        NSFontAttributeName: [NSFont systemFontOfSize:px * 0.50]
    };
    NSSize strSize = [maple sizeWithAttributes:attrs];
    [maple drawAtPoint:NSMakePoint((px - strSize.width) / 2.0, (px - strSize.height) / 2.0) withAttributes:attrs];

    [NSGraphicsContext restoreGraphicsState];
    NSData *png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    [png writeToFile:outPath atomically:YES];
}

int main() {
    @autoreleasepool {
        int sizes[] = {16, 32, 64, 128, 256, 512, 1024};
        for (int i = 0; i < 7; i++) {
            int s = sizes[i];
            if (s <= 512) {
                writeIconSize(s, [NSString stringWithFormat:@"/tmp/DiscoverCanada.iconset/icon_%dx%d.png", s, s]);
            }
            if (s >= 32) {
                int half = s / 2;
                writeIconSize(s, [NSString stringWithFormat:@"/tmp/DiscoverCanada.iconset/icon_%dx%d@2x.png", half, half]);
            }
        }
    }
    return 0;
}
EOF

clang -ObjC -framework Foundation -framework AppKit /tmp/gen_icon.m -o /tmp/gen_icon
/tmp/gen_icon
iconutil -c icns "$ICONSET_DIR" -o "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
rm -rf /tmp/gen_icon /tmp/gen_icon.m "$ICONSET_DIR"

echo "4. Bundling Application Source & High-Res PDF Assets inside .app..."
cp -R "$PROJECT_DIR/src" "$APP_BUNDLE/Contents/Resources/app/src"
cp -R "$PROJECT_DIR/assets" "$APP_BUNDLE/Contents/Resources/app/assets"

echo "5. Ad-hoc signing Universal App Bundle for macOS Portability..."
codesign --force --deep --sign - "$APP_BUNDLE"

echo "6. Creating Portable .command Launcher..."
cat << 'EOF' > "$PROJECT_DIR/Launch Discover Canada Prep.command"
#!/bin/zsh
DIR="$(cd "$(dirname "$0")" && pwd)"
open "$DIR/Discover Canada Prep.app"
EOF
chmod +x "$PROJECT_DIR/Launch Discover Canada Prep.command"

echo "✅ Universal macOS App Bundle built successfully at: $APP_BUNDLE"
