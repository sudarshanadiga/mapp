# Root main.py - imports and runs the router app
import sys
import importlib.util
from pathlib import Path

# Get the path to router_app.py
router_app_path = Path(__file__).parent / 'router-backend' / 'router_app.py'

# Load the module dynamically
spec = importlib.util.spec_from_file_location("router_app", router_app_path)
router_module = importlib.util.module_from_spec(spec)
sys.modules["router_app"] = router_module
spec.loader.exec_module(router_module)

# Get the app from the module
app = router_module.app

# This allows Render to find the app at the root level