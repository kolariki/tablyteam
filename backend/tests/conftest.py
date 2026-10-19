import os
import tempfile

os.environ.setdefault("ARENA_DATA_DIR", tempfile.mkdtemp(prefix="arena-test-"))
os.environ.setdefault("ARENA_DB", os.path.join(os.environ["ARENA_DATA_DIR"], "test.db"))
os.environ["ARENA_SECRET_KEY"] = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
os.environ["LANGFUSE_PUBLIC_KEY"] = ""  # empty = disabled (load_dotenv never overrides an existing var)
os.environ["LANGFUSE_SECRET_KEY"] = ""
