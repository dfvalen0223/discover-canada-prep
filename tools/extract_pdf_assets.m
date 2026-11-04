#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <PDFKit/PDFKit.h>

void saveBitmapRep(NSBitmapImageRep *rep, NSString *path, float quality) {
    NSDictionary *props = @{NSImageCompressionFactor: @(quality)};
    NSData *jpgData = [rep representationUsingType:NSBitmapImageFileTypeJPEG properties:props];
    [jpgData writeToFile:path atomically:YES];
}

NSBitmapImageRep* renderFullPage(PDFPage *page, CGFloat scale) {
    NSRect cropRect = [page boundsForBox:kPDFDisplayBoxCropBox];
    NSInteger w = (NSInteger)round(cropRect.size.width * scale);
    NSInteger h = (NSInteger)round(cropRect.size.height * scale);

    NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
        initWithBitmapDataPlanes:NULL
                      pixelsWide:w
                      pixelsHigh:h
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

    [[NSColor whiteColor] set];
    NSRectFill(NSMakeRect(0, 0, w, h));

    CGContextRef cg = [ctx CGContext];
    CGContextSaveGState(cg);
    CGContextScaleCTM(cg, scale, scale);
    [page drawWithBox:kPDFDisplayBoxCropBox toContext:cg];
    CGContextRestoreGState(cg);

    [NSGraphicsContext restoreGraphicsState];
    return rep;
}

NSBitmapImageRep* renderPageRegion(PDFPage *page, CGFloat scale, NSRect normRect) {
    NSBitmapImageRep *fullRep = renderFullPage(page, scale);
    CGFloat fullW = [fullRep pixelsWide];
    CGFloat fullH = [fullRep pixelsHigh];

    // normRect is in top-left origin normalized [0..1] coordinates: (x, y_from_top, w, h)
    // Note: CGImageCreateWithImageInRect uses TOP-LEFT origin in pixel space!
    CGRect pixelRect = CGRectMake(
        round(normRect.origin.x * fullW),
        round(normRect.origin.y * fullH),
        round(normRect.size.width * fullW),
        round(normRect.size.height * fullH)
    );

    CGImageRef subImg = CGImageCreateWithImageInRect([fullRep CGImage], pixelRect);
    NSBitmapImageRep *croppedRep = [[NSBitmapImageRep alloc] initWithCGImage:subImg];
    CGImageRelease(subImg);
    return croppedRep;
}

int main() {
    @autoreleasepool {
        NSString *pdfPath = @"/Users/danielvalencia/.gemini/antigravity/brain/0a83f9cd-8a17-42dc-8b66-7cb75f6bc342/.user_uploaded/media_1793754748709_79204f82.pdf";
        PDFDocument *doc = [[PDFDocument alloc] initWithURL:[NSURL fileURLWithPath:pdfPath]];
        if (!doc) { NSLog(@"Failed to open PDF"); return 1; }

        NSString *baseDir = @"/Users/danielvalencia/.gemini/antigravity/scratch/discover-canada-mac-app/assets";
        [[NSFileManager defaultManager] createDirectoryAtPath:[baseDir stringByAppendingPathComponent:@"pdf_pages"] withIntermediateDirectories:YES attributes:nil error:nil];
        [[NSFileManager defaultManager] createDirectoryAtPath:[baseDir stringByAppendingPathComponent:@"figures"] withIntermediateDirectories:YES attributes:nil error:nil];

        // Render all 68 single pages from the Illustrated Guide
        for (NSUInteger i = 0; i < doc.pageCount; i++) {
            PDFPage *p = [doc pageAtIndex:i];
            NSBitmapImageRep *rep = renderFullPage(p, 1.6);
            NSString *outPath = [NSString stringWithFormat:@"%@/pdf_pages/page_%02lu.jpg", baseDir, (unsigned long)(i + 1)];
            saveBitmapRep(rep, outPath, 0.80);
        }

        // Crop specific high-res figures, maps, tables & charts for exam & study questions:
        // 1. Map of Canada (Page 45, bottom map)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:44], 2.5, NSMakeRect(0.0, 0.34, 0.84, 0.62)), [baseDir stringByAppendingPathComponent:@"figures/map_canada_full.jpg"], 0.90);
        // 2. Regions & Capitals Table (Page 45, top table)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:44], 2.5, NSMakeRect(0.11, 0.03, 0.68, 0.31)), [baseDir stringByAppendingPathComponent:@"figures/table_regions_capitals.jpg"], 0.90);
        // 3. System of Government Chart (Page 29, bottom right)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:28], 2.6, NSMakeRect(0.45, 0.62, 0.36, 0.35)), [baseDir stringByAppendingPathComponent:@"figures/chart_system_of_government.jpg"], 0.90);
        // 4. How a Bill Becomes Law (Page 29, top table)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:28], 2.5, NSMakeRect(0.11, 0.03, 0.68, 0.21)), [baseDir stringByAppendingPathComponent:@"figures/chart_bill_becomes_law.jpg"], 0.90);
        // 5. Levels of Government Responsibilities Table (Page 33)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:32], 2.5, NSMakeRect(0.11, 0.40, 0.68, 0.41)), [baseDir stringByAppendingPathComponent:@"figures/table_levels_of_government.jpg"], 0.90);
        // 6. Voting Procedures (Page 32)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:31], 2.2, NSMakeRect(0.16, 0.11, 0.82, 0.84)), [baseDir stringByAppendingPathComponent:@"figures/chart_voting_procedures.jpg"], 0.88);
        // 7. Expansion of the Dominion Timeline & Sir John A. Macdonald (Page 19, top)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:18], 2.2, NSMakeRect(0.0, 0.0, 1.0, 0.36)), [baseDir stringByAppendingPathComponent:@"figures/chart_expansion_dominion.jpg"], 0.88);
        // 8. National Public Holidays Table (Page 41, bottom)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:40], 2.5, NSMakeRect(0.11, 0.58, 0.68, 0.35)), [baseDir stringByAppendingPathComponent:@"figures/table_public_holidays.jpg"], 0.90);
        // 9. Canadian Symbols Collage & Red Ensign (Page 38)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:37], 2.2, NSMakeRect(0.0, 0.25, 1.0, 0.72)), [baseDir stringByAppendingPathComponent:@"figures/visual_canadian_symbols.jpg"], 0.88);
        // 10. War of 1812 Visuals (Page 17)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:16], 2.2, NSMakeRect(0.0, 0.0, 1.0, 0.75)), [baseDir stringByAppendingPathComponent:@"figures/visual_war_of_1812.jpg"], 0.88);
        // 11. D-Day Juno Beach Painting (Page 23, top)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:22], 2.2, NSMakeRect(0.0, 0.0, 0.83, 0.50)), [baseDir stringByAppendingPathComponent:@"figures/visual_dday_juno_beach.jpg"], 0.88);
        // 12. CPR Last Spike & Railway (Page 20)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:19], 2.2, NSMakeRect(0.16, 0.16, 0.83, 0.65)), [baseDir stringByAppendingPathComponent:@"figures/visual_cpr_railway.jpg"], 0.88);
        // 13. Justice System Scales of Justice (Page 36)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:35], 2.2, NSMakeRect(0.16, 0.31, 0.83, 0.39)), [baseDir stringByAppendingPathComponent:@"figures/visual_scales_of_justice.jpg"], 0.88);
        // 14. Canadian Sports & Heroes (Page 26)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:25], 2.2, NSMakeRect(0.0, 0.16, 1.0, 0.82)), [baseDir stringByAppendingPathComponent:@"figures/visual_sports_and_science.jpg"], 0.88);
        // 15. Confederation Bridge (Page 56, bottom)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:55], 2.2, NSMakeRect(0.16, 0.66, 0.83, 0.33)), [baseDir stringByAppendingPathComponent:@"figures/visual_confederation_bridge.jpg"], 0.88);
        // 16. Mount Logan & Northern Territories (Page 50)
        saveBitmapRep(renderPageRegion([doc pageAtIndex:49], 2.2, NSMakeRect(0.16, 0.56, 0.83, 0.20)), [baseDir stringByAppendingPathComponent:@"figures/visual_mount_logan.jpg"], 0.88);

        NSLog(@"Successfully rendered all 68 single PDF pages and 16 high-res cropped figures!");
    }
    return 0;
}
