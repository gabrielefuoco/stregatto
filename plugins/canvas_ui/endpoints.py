import os
from fastapi import HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from cat import endpoint, plugin

@endpoint.get("/canvas", include_in_schema=False)
async def canvas_index() -> HTMLResponse:
    index_path = os.path.abspath(
        os.path.join(plugin.path, "public/index.html")
    )
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="Canvas UI not found")
    return FileResponse(path=index_path)

@endpoint.get("/canvas/assets/{path:path}", include_in_schema=False)
async def canvas_assets(path: str) -> HTMLResponse:
    assets_path = os.path.abspath(
        os.path.join(plugin.path, "public")
    )
    file_path = os.path.abspath(os.path.join(assets_path, path))

    # Prevent directory traversal
    if not file_path.startswith(assets_path):
        raise HTTPException(status_code=403, detail="Access forbidden")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Mime type is automatically handled by FileResponse, but we can set headers if needed
    return FileResponse(path=file_path)
