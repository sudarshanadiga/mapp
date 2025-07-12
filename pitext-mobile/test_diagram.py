#!/usr/bin/env python3
"""
Simple test script for PiText Mobile diagram generation.
"""

import asyncio
import sys
from pathlib import Path

# Add the current directory to the path so we can import from main.py
sys.path.insert(0, str(Path(__file__).parent))

from main import LLMService

async def test_diagram_generation():
    """Test the diagram generation functionality."""
    print("🧪 Testing PiText Mobile diagram generation...")
    
    # Create LLM service
    llm_service = LLMService()
    
    # Test query
    test_query = "baking a cake"
    
    print(f"📝 Testing with query: '{test_query}'")
    
    try:
        # Generate diagram
        result = await llm_service.generate_diagram(test_query)
        
        print("✅ Diagram generation successful!")
        print(f"📊 Content: {result['content'][:100]}...")
        print(f"🎨 Diagram code (first 200 chars): {result['diagram'][:200]}...")
        
        # Check if diagram code looks valid
        if 'flowchart' in result['diagram'] or 'graph' in result['diagram']:
            print("✅ Diagram code appears to be valid Mermaid code")
        else:
            print("⚠️  Diagram code doesn't appear to be valid Mermaid code")
            
    except Exception as e:
        print(f"❌ Diagram generation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_diagram_generation()) 