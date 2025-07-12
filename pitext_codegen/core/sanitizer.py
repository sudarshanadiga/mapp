# core/sanitizer.py
"""
Mermaid diagram sanitization utilities for CodeGen.
"""

import re
import html
from typing import List, Tuple


class MermaidSanitizer:
    """Static helpers that convert raw LLM output into valid Mermaid."""

    # ------------------------------------------------------------------
    # mapping tables ----------------------------------------------------
    # ------------------------------------------------------------------
    UNICODE_REPLACEMENTS: List[Tuple[str, str]] = [
        ("\u2013", "-"),   # en dash –
        ("\u2014", "-"),   # em dash —
        ("\u201C", '"'),  # left  double quote "
        ("\u201D", '"'),  # right double quote "
        ("\u2018", "'"),   # left  single quote '
        ("\u2019", "'"),   # right single quote '
        ("\u00A0", " "),   # non‑breaking space
        ("\u200B", ""),    # zero‑width space
    ]

    HTML_ENTITIES: List[Tuple[str, str]] = [
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", '"'),
        ("&#39;", "'"),
    ]

    # ------------------------------------------------------------------
    # public API --------------------------------------------------------
    # ------------------------------------------------------------------
    @classmethod
    def sanitize(cls, snippet: str) -> str:
        """Full sanitisation pipeline."""
        text = snippet.strip()
        
        # STEP 1: Extract and preserve the init block
        init_block = None
        init_pattern = r'(%%\{init:.*?\}%%)'
        init_match = re.search(init_pattern, text, re.DOTALL)
        
        if init_match:
            init_block = init_match.group(0)
            # Replace with a unique placeholder that won't be affected by sanitization
            text = text.replace(init_block, '###MERMAID_INIT_BLOCK_PLACEHOLDER###')
        
        # STEP 2: Apply all sanitization steps to the rest
        text = cls._decode_html_entities(text)
        text = cls._remove_markdown_fences(text)
        text = cls._sanitize_special_chars(text)
        text = cls._normalise_unicode(text)
        text = cls._fix_line_breaks(text)

        # STEP 3: Process line by line (but skip placeholder line)
        fixed_lines: List[str] = []
        for line in text.splitlines():
            if '###MERMAID_INIT_BLOCK_PLACEHOLDER###' in line:
                # Don't process lines with our placeholder
                fixed_lines.append(line)
            else:
                fixed_lines.append(cls._process_line(line))
        
        text = "\n".join(fixed_lines)
        
        # STEP 4: Final cleanup (but preserve placeholder)
        text = cls._final_cleanup(text)
        
        # STEP 5: Restore the original init block
        if init_block:
            text = text.replace('###MERMAID_INIT_BLOCK_PLACEHOLDER###', init_block)
        
        return text

    # ------------------------------------------------------------------
    # individual steps --------------------------------------------------
    # ------------------------------------------------------------------
    @staticmethod
    def _decode_html_entities(text: str) -> str:
        """Decode once, then again to catch double‑encoding."""
        return html.unescape(html.unescape(text))

    @staticmethod
    def _remove_markdown_fences(text: str) -> str:
        """Drop ```mermaid fences that sometimes wrap the snippet."""
        text = re.sub(r"^```(?:mermaid)?\s*", "", text, flags=re.MULTILINE | re.IGNORECASE)
        return re.sub(r"```$", "", text, flags=re.MULTILINE)

    @classmethod
    def _sanitize_special_chars(cls, text: str) -> str:
        """Replace problematic special characters while preserving Mermaid syntax."""
        # Process line by line to handle Mermaid directives properly
        lines = text.splitlines()
        sanitized_lines = []
        
        for line in lines:
            stripped = line.strip()
            
            # Skip lines that are Mermaid directives or should be preserved
            if any(stripped.startswith(directive) for directive in 
                   ['%%{init:', 'flowchart', 'sequenceDiagram', 'classDiagram', 'graph', 'participant', 'activate', 'deactivate']):
                sanitized_lines.append(line)
                continue
            
            # Skip lines with our placeholder
            if '###MERMAID_INIT_BLOCK_PLACEHOLDER###' in line:
                sanitized_lines.append(line)
                continue
            
            # Process regular content lines
            result = line
            
            # Always replace these problematic characters
            always_replace = {
                ";": " ",          # semicolon breaks parsing
                "\u2013": "-",     # en dash
                "\u2014": "-",     # em dash
                "\u201C": '"',     # smart quotes
                "\u201D": '"',
                "\u2018": "'",
                "\u2019": "'",
                "\u00A0": " ",     # non-breaking space
                "\u200B": "",      # zero-width space
                "…": "...",        # ellipsis
                "•": "-",          # bullet
                "$": "USD ",       # dollar
                "™": " TM",        # trademark
                "®": " (R)",       # registered
                "©": " (C)",       # copyright
                "\\": "/",         # backslash
                "`": "'",          # backtick
            }
            
            for old, new in always_replace.items():
                result = result.replace(old, new)
            
            
            sanitized_lines.append(result)
        
        return "\n".join(sanitized_lines)

    @classmethod
    def _normalise_unicode(cls, text: str) -> str:
        """Replace smart punctuation and non‑printables with ASCII."""
        for bad, good in cls.UNICODE_REPLACEMENTS:
            text = text.replace(bad, good)
        return text

    @staticmethod
    def _fix_line_breaks(text: str) -> str:
        """Normalise all forms of <br/> to <br>."""
        return re.sub(r"<\s*br\s*/?\s*>", "<br>", text, flags=re.IGNORECASE)

    # ------------------------------------------------------------------
    # per‑line processing ----------------------------------------------
    # ------------------------------------------------------------------
    @classmethod
    def _process_line(cls, line: str) -> str:
        stripped = line.strip()

        # 1. Subgraph declarations
        if stripped.lower().startswith("subgraph"):
            fixed = cls._fix_subgraph(stripped)
            if stripped != fixed:
                import logging
                logging.debug(f"Fixed subgraph: '{stripped}' -> '{fixed}'")
            return fixed

        # 2. Parentheses nodes  A("text") → A["text"]
        m = re.match(r"(\w+)\(\"([^\"]+)\"\)(.*)$", stripped)
        if m:
            node_id, label, rest = m.groups()
            return f"{node_id}[\"{label}\"]{rest}"

        # 3. Bracket nodes with stray quotes
        m = re.match(r"(\w+)\[\"([^\"]+)\"\](.*)$", stripped)
        if m:
            node_id, label, rest = m.groups()
            return f"{node_id}[\"{label}\"]{rest}"

        # 4. Circular nodes ((text)) – de‑quote content if present
        if "((" in stripped and "))" in stripped:
            def fix_circular(m):
                content = m.group(1).replace('"', "'")
                return f"(({content}))"
            return re.sub(r"\(\(([^)]+)\)\)", fix_circular, stripped)

        # 5. Fallback – ensure A[label] has quotes
        # Don't apply to subgraph lines as they're already handled
        if not stripped.lower().startswith("subgraph"):
            return cls._fix_general_quotes(stripped)
        
        return stripped

    # ---------------------- specific fix helpers -----------------------
    @staticmethod
    def _fix_subgraph(line: str) -> str:
        # Extract everything after "subgraph"
        content = line[len("subgraph"):].strip()
        
        # For simplicity, we'll just extract a valid ID and ignore any labels
        # This avoids all the bracket/quote parsing issues
        
        # Try to find a valid ID at the start
        id_match = re.match(r'^(\w+)', content)
        
        if id_match:
            safe_id = id_match.group(1).strip('_')
            # Remove any trailing underscores or numbers that look like errors
            safe_id = re.sub(r'_+$', '', safe_id)
            safe_id = re.sub(r'_+', '_', safe_id)
        else:
            # No valid ID found, try to extract from any text present
            words = re.findall(r'\b[A-Za-z]+\b', content)
            if words:
                safe_id = words[0].capitalize()
            else:
                safe_id = "Subgraph"
        
        # Ensure the ID is valid
        if not safe_id or not re.match(r'^[A-Za-z]\w*$', safe_id):
            safe_id = 'Subgraph'
        
        # Return simple subgraph without label
        return f'subgraph {safe_id}'

    @staticmethod
    def _fix_general_quotes(line: str) -> str:
        def repl(m: re.Match) -> str:
            node_id, label = m.groups()
            label = label.strip().strip('"').replace('"', "'")
            return f"{node_id}[\"{label}\"]"

        return re.sub(r"(\b[^\s\[\]]+)?\[([^\]]+)\]", repl, line)

    # ----------------------- final cleanup -----------------------------
    @classmethod
    def _final_cleanup(cls, text: str) -> str:
        for entity, repl in cls.HTML_ENTITIES:
            text = text.replace(entity, repl)
        # Remove accidental identifier‑quote‑bracket sequences  id"[ -> id[
        return re.sub(r'"\[', '[', text)


# convenience wrapper --------------------------------------------------

def sanitize_mermaid(snippet: str) -> str:
    """Return a cleaned Mermaid snippet suitable for rendering."""
    # Log the raw input for debugging
    import logging
    logger = logging.getLogger(__name__)
    
    # Check for init block
    if '%%{init:' in snippet:
        logger.info("ℹ️ Detected init block in Mermaid code - will preserve it untouched")
    
    # Check for common problematic patterns
    if '___[' in snippet or ']["' in snippet and '"]"]' in snippet:
        logger.warning("Detected potentially malformed subgraph syntax in Mermaid code")
    
    sanitized = MermaidSanitizer.sanitize(snippet)
    
    # Log significant changes
    if snippet != sanitized and logger.isEnabledFor(logging.DEBUG):
        logger.debug("Mermaid code was sanitized")
        # Log first few lines of changes to avoid huge logs
        original_lines = snippet.split('\n')[:10]
        sanitized_lines = sanitized.split('\n')[:10]
        for i, (orig, san) in enumerate(zip(original_lines, sanitized_lines)):
            if orig != san:
                logger.debug(f"Line {i}: '{orig}' -> '{san}'")
    
    return sanitized