"""
Core configuration for the backend app.
"""

# CORS origins allowed to access the API.
# localhost:3000 for local Next.js dev server.
# Render URL preserved for future deployment.
CORS_ORIGINS: list[str] = [
    "http://localhost:3000",
    "https://hyrra-ai-frontend.onrender.com",
]
