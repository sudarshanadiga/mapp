#!/usr/bin/env python3
"""
Debug script to test router loading and identify routing issues
"""

import sys
from pathlib import Path

# Add router-backend to path
sys.path.append('router-backend')

def check_module_exports():
    """Check what each module exports"""
    print("Checking module exports...")
    
    try:
        from router_app import load_app_module, BASE_DIR
        
        # Test each module and see what it exports
        modules = [
            ("pitext-desktop", "desktop_main"),
            ("pitext-mobile", "mobile_main"), 
            ("pitext_codegen", "codegen_main"),
            ("pitext_travel", "travel_main"),
            ("calendar_integration", "calendar_main")
        ]
        
        for folder, module_name in modules:
            print(f"\nChecking {folder}...")
            app_path = BASE_DIR / folder
            main_file = app_path / "main.py"
            
            if not main_file.exists():
                print(f"  ❌ main.py not found in {folder}")
                continue
                
            # Load the module
            import importlib.util
            spec = importlib.util.spec_from_file_location(module_name, main_file)
            module = importlib.util.module_from_spec(spec)
            sys.path.insert(0, str(app_path))
            spec.loader.exec_module(module)
            sys.path.remove(str(app_path))
            
            # Check what's exported
            exports = [attr for attr in dir(module) if not attr.startswith('_')]
            print(f"  Exports: {exports}")
            
            # Check specifically for app and asgi_app
            if hasattr(module, 'app'):
                print(f"  ✅ Has 'app'")
            if hasattr(module, 'asgi_app'):
                print(f"  ✅ Has 'asgi_app'")
                
            # Try to load the app
            try:
                app = getattr(module, 'asgi_app', getattr(module, 'app', None))
                if app:
                    print(f"  ✅ Successfully loaded app")
                else:
                    print(f"  ❌ No app found")
            except Exception as e:
                print(f"  ❌ Error loading app: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking modules: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_app_loading():
    """Test loading each app individually"""
    print("\nTesting app loading...")
    
    try:
        from router_app import load_app_module, BASE_DIR
        
        print(f"Base directory: {BASE_DIR}")
        
        # Test desktop app
        print("\n1. Testing desktop app...")
        desktop_app = load_app_module(BASE_DIR / "pitext_desktop", "desktop_main")
        print("✅ Desktop app loaded successfully")
        
        # Test mobile app
        print("\n2. Testing mobile app...")
        mobile_app = load_app_module(BASE_DIR / "pitext-mobile", "mobile_main")
        print("✅ Mobile app loaded successfully")
        
        # Test codegen app
        print("\n3. Testing codegen app...")
        codegen_app = load_app_module(BASE_DIR / "pitext_codegen", "codegen_main")
        print("✅ Codegen app loaded successfully")
        
        # Test travel app
        print("\n4. Testing travel app...")
        travel_app = load_app_module(BASE_DIR / "pitext_travel", "travel_main")
        print("✅ Travel app loaded successfully")
        
        # Test calendar app
        print("\n5. Testing calendar app...")
        calendar_app = load_app_module(BASE_DIR / "calendar_integration", "calendar_main")
        print("✅ Calendar app loaded successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Error loading apps: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_router_creation():
    """Test creating the router app"""
    print("\nTesting router creation...")
    
    try:
        from router_app import RouterApp, desktop_app, mobile_app, codegen_app, travel_app, calendar_app
        
        router = RouterApp(desktop_app, mobile_app, codegen_app, travel_app, calendar_app)
        print("✅ Router created successfully")
        return router
        
    except Exception as e:
        print(f"❌ Error creating router: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_routing_logic():
    """Test the routing logic"""
    print("\nTesting routing logic...")
    
    router = test_router_creation()
    if not router:
        return
    
    # Test paths
    test_paths = [
        "/",
        "/desktop/",
        "/mobile/",
        "/codegen/",
        "/travel/",
        "/calendar/",
        "/socket.io/",
        "/unknown/"
    ]
    
    for path in test_paths:
        print(f"Testing path: {path}")
        # Create a mock scope
        scope = {
            "type": "http",
            "path": path,
            "headers": [(b"user-agent", b"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")]
        }
        
        # This is a simplified test - in reality we'd need to mock receive/send
        print(f"  Path: {path} -> Would route to appropriate app")

if __name__ == "__main__":
    print("=== Router Debug Test ===\n")
    
    check_module_exports()
    
    if test_app_loading():
        test_router_creation()
        test_routing_logic()
    
    print("\n=== Debug Complete ===") 