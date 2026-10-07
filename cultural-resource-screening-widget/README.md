# Cultural Resource Screening Tool

Custom ArcGIS Experience Builder Developer Edition widget.

## Workflow
1. Choose Circle, Rectangle, or Polygon.
2. Draw around the part of the broadband route to review.
3. The widget queries cultural-resource layers using `intersects`.
4. Returned features are counted and highlighted.

## Default layer names
- MWT Broadband Lines
- Native Burial Grounds
- MHC Inventory Points
- Forest No Disturb Area
- Burial Protection Buffer 50ft
- Burial sites digitized

## Install
Copy `cultural-resource-screening-tool` to `<Experience Builder Developer Edition>/client/your-extensions/widgets/`, restart the Developer Edition client, add the widget, and connect it to your Map widget.

## Notes
The drawn review geometry is temporary and is not saved. Layer titles are configurable in widget settings. Treat this as a screening aid, not as the final cultural-resource determination.
