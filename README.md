# ToolDr.ai Design Editor — MVP

A dependency-free, mobile-friendly 1080×1350 social-post layer editor.

### Included
- Text layers with fixed font family, size, weight and color
- Shape layers
- Image upload layers
- Drag-and-drop positioning
- Layer list and property editor
- Project background/name
- Local save/load
- Scene JSON export/import
- No API keys or paid services required

### Run
Open `index.html` directly in a browser, or serve the folder with any static server.

### Supabase
The existing ToolDr.ai Supabase backend already has `public.design_projects`. This MVP intentionally keeps persistence local so it can run with zero dependencies. The next integration step is to connect the Save/Load buttons to that table after the host app's Supabase auth session is available.
