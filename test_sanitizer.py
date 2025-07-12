#!/usr/bin/env python3
"""
Test script for the intelligent Mermaid sanitizer.
"""

import sys
import os

# Add the pitext_desktop directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pitext_desktop'))

from core.sanitizer import MermaidSanitizer

def test_sanitizer():
    """Test various Mermaid syntax patterns with the sanitizer."""
    
    test_cases = [
        # Test 1: Basic sequence diagram with special characters
        {
            "name": "Sequence diagram with special chars",
            "input": '''sequenceDiagram
    participant User
    participant System
    
    User->>System: Hello; how are you?
    Note over User,System: This is a test with smart quotes "hello" and em dash —
    rect rgb(255,235,235)
        Note over User: User-specific features<br/>1. Feature A1 and brief explanation<br/>2. Feature A2 and brief explanation
    end''',
            "expected_preserved": ["sequenceDiagram", "participant", "Note over", "rect rgb"]
        },
        
        # Test 2: Flowchart with problematic characters
        {
            "name": "Flowchart with problematic chars",
            "input": '''flowchart TD
    A[Start] --> B{Decision?}
    B -->|Yes| C[Process with @ symbol]
    B -->|No| D[End with # hash]
    C --> E[Final step with $ dollar]''',
            "expected_preserved": ["flowchart", "-->", "|Yes|", "|No|"]
        },
        
        # Test 3: Init block preservation
        {
            "name": "Init block preservation",
            "input": '''%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ff0000'}}}%%
graph TD
    A[Start] --> B[End]''',
            "expected_preserved": ["%%{init:", "graph TD"]
        },
        
        # Test 4: Complex sequence diagram from prompt
        {
            "name": "Complex sequence diagram from prompt",
            "input": '''%%{init:
  {
    "themeVariables": {
      "fontFamily": "sans-serif",
      "fontSize": "16px",
      "noteTextColor": "#000000",
      "noteBkgColor": "#ffffff",
      "noteBorderColor": "#cccccc"
    },
"sequence": {
  "useMaxWidth": false,
  "wrap": false,
  "width": 350,
  "mirrorActors": false,
  "noteAlign": "center",
  "messageMargin": 10,
  "boxMargin": 10,
  "noteMargin": 10,
  "wrapPadding": 5
}   , "themeCSS": ".actor-line { stroke-width: 0.0001px !important; } .noteText { white-space: pre-wrap !important; word-wrap: break-word !important; font-size: 16px !important; line-height: 1.2 !important; padding: 8px !important; margin: 0 !important; } .note { padding: 5px !important; margin: 2px 0 !important; }"
  }
}%%
sequenceDiagram
  participant Item1
  participant Item2
  participant Item3

  activate Item1
  activate Item2
  activate Item3

  rect rgb(230,255,230)
      Note over Item1,Item3: Similarities
      Note over Item1,Item3: 1. Similarity aspect1 and brief explanation
      Note over Item1,Item3: 2. Similarity aspect2 and brief explanation
      Note over Item1,Item3: 3. Similarity aspect3 and brief explanation
  end

  rect rgb(255,235,235)
    Note over Item1: Unique aspects<br/>1. Feature A1 and brief explanation<br/>2. Feature A2 and brief explanation<br/>3. Feature A3 and brief explanation
  end

  rect rgb(255,235,235)
    Note over Item2: Unique aspects<br/>1. Feature B1 and brief explanation<br/>2. Feature B2 and brief explanation<br/>3. Feature B3 and brief explanation
  end

  rect rgb(255,235,235)
    Note over Item3: Unique aspects<br/>1. Feature C1 and brief explanation<br/>2. Feature C2 and brief explanation<br/>3. Feature C3 and brief explanation
  end

  deactivate Item1
  deactivate Item2
  deactivate Item3''',
            "expected_preserved": ["%%{init:", "sequenceDiagram", "participant", "activate", "deactivate", "Note over", "rect rgb"]
        },
        
        # Test 5: Text with special characters that should be replaced
        {
            "name": "Text with special characters",
            "input": '''flowchart TD
    A[Start with smart quotes "hello" and em dash —] --> B[End with ellipsis …]
    C[Item with bullet • and @ symbol] --> D[Final with # hash and $ dollar]
    E[Text with ™ trademark and ® registered] --> F[End with © copyright]''',
            "expected_preserved": ["flowchart TD", "-->"]
        }
    ]
    
    print("🧪 Testing Intelligent Mermaid Sanitizer\n")
    print("=" * 60)
    
    all_passed = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}: {test_case['name']}")
        print("-" * 40)
        
        # Get sanitized output
        sanitized = MermaidSanitizer.sanitize(test_case['input'])
        
        # Check if expected patterns are preserved
        preserved_count = 0
        for pattern in test_case['expected_preserved']:
            if pattern in sanitized:
                preserved_count += 1
                print(f"✅ Preserved: {pattern}")
            else:
                print(f"❌ Missing: {pattern}")
                all_passed = False
        
        # Check for problematic characters that should be replaced
        problematic_chars = [';', '—', '"', '"', ''', ''', '…', '•', '@', '#', '$', '™', '®', '©']
        replaced_count = 0
        for char in problematic_chars:
            if char in test_case['input'] and char not in sanitized:
                replaced_count += 1
                print(f"✅ Replaced: {repr(char)}")
        
        print(f"\n📊 Results: {preserved_count}/{len(test_case['expected_preserved'])} patterns preserved, {replaced_count} problematic chars replaced")
        
        # Show a snippet of the sanitized output
        lines = sanitized.split('\n')[:5]
        print(f"\n📝 Sanitized output (first 5 lines):")
        for line in lines:
            print(f"   {line}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed! The intelligent sanitizer is working correctly.")
    else:
        print("⚠️  Some tests failed. Please review the output above.")
    
    return all_passed

if __name__ == "__main__":
    success = test_sanitizer()
    sys.exit(0 if success else 1) 