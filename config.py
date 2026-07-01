import os
from dotenv import load_dotenv

load_dotenv()

# Centralized Configuration – Single Source of Truth
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY is missing from environment variables.")