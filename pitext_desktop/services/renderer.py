# services/renderer.py
"""
Diagram rendering service.
Handles rendering Mermaid diagrams as HTML or images.
"""

import base64
import logging
from typing import Optional

from playwright.async_api import async_playwright, Browser, Page

from core.config import get_config
from api.models import RenderResult


logger = logging.getLogger(__name__)


class DiagramRenderer:
    """Handles rendering of Mermaid diagrams."""
    
    def __init__(self):
        """Initialize the renderer with configuration."""
        self.config = get_config()
        self._browser: Optional[Browser] = None
    
    async def render(self, mermaid_code: str) -> RenderResult:
        """
        Render a Mermaid diagram based on configured mode.
        
        Args:
            mermaid_code: Mermaid diagram code
            
        Returns:
            RenderResult with type and content
            
        Raises:
            Exception: If rendering fails
        """
        if self.config.RENDER_MODE == "image":
            return await self._render_as_image(mermaid_code)
        else:
            return self._render_as_html(mermaid_code)
    
    def _render_as_html(self, mermaid_code: str) -> RenderResult:
        """
        Render diagram as HTML (client-side rendering).
        
        Args:
            mermaid_code: Mermaid diagram code
            
        Returns:
            RenderResult with HTML content
        """
        logger.debug("Rendering as HTML")
        
        return RenderResult(
            render_type="html",
            rendered_content=mermaid_code
        )
    
    async def _render_as_image(self, mermaid_code: str) -> RenderResult:
        """
        Render diagram as PNG image using Playwright.
        
        Args:
            mermaid_code: Mermaid diagram code
            
        Returns:
            RenderResult with base64-encoded image
            
        Raises:
            Exception: If browser rendering fails
        """
        logger.debug("Rendering as image using Playwright")
        
        html_content = self._create_html_page(mermaid_code)
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=self.config.PLAYWRIGHT_ARGS
            )
            
            try:
                page = await browser.new_page()
                
                # Set viewport for consistent rendering
                await page.set_viewport_size({"width": 1200, "height": 800})
                
                # Load the HTML content
                await page.set_content(html_content)
                
                # Wait for Mermaid to render
                try:
                    await page.wait_for_selector(
                        '.mermaid svg',
                        timeout=self.config.PLAYWRIGHT_TIMEOUT
                    )
                except Exception as e:
                    logger.error(f"Mermaid rendering timeout: {str(e)}")
                    # Try to get any error message
                    error_text = await self._get_mermaid_error(page)
                    if error_text:
                        raise ValueError(f"Mermaid error: {error_text}")
                    raise ValueError("Failed to render Mermaid diagram")
                
                # Get the diagram element
                element = await page.query_selector('.mermaid')
                if not element:
                    raise ValueError("No Mermaid diagram found in rendered page")
                
                # Take screenshot
                screenshot = await element.screenshot(
                    type='png',
                    omit_background=True
                )
                
                # Encode as base64
                encoded = base64.b64encode(screenshot).decode('utf-8')
                data_url = f"data:image/png;base64,{encoded}"
                
                logger.info("Successfully rendered diagram as image")
                
                return RenderResult(
                    render_type="image",
                    rendered_content=data_url
                )
                
            finally:
                await browser.close()
    
    def _create_html_page(self, mermaid_code: str) -> str:
        """
        Create a minimal HTML page for rendering.
        
        Args:
            mermaid_code: Mermaid diagram code
            
        Returns:
            Complete HTML page as string
        """
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    margin: 0;
                    padding: 20px;
                    background: white;
                    font-family: Arial, sans-serif;
                }}
                .mermaid {{
                    text-align: center;
                }}
                .error {{
                    color: red;
                    padding: 20px;
                    border: 1px solid red;
                    background: #ffeeee;
                }}
            </style>
            <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
            <script>
                mermaid.initialize({{ 
                    startOnLoad: true,
                    theme: 'default',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: 14,
                    securityLevel: 'loose'
                }});
                
                // Error handling
                window.addEventListener('error', function(e) {{
                    document.body.innerHTML = '<div class="error">Rendering error: ' + e.message + '</div>';
                }});
            </script>
        </head>
        <body>
            <div class="mermaid">
{mermaid_code}
            </div>
        </body>
        </html>
        """
    
    async def _get_mermaid_error(self, page: Page) -> Optional[str]:
        """
        Try to extract any Mermaid error message from the page.
        
        Args:
            page: Playwright page object
            
        Returns:
            Error message if found, None otherwise
        """
        try:
            # Check for error elements
            error_element = await page.query_selector('.error')
            if error_element:
                return await error_element.text_content()
            
            # Check for Mermaid error in console
            # This would require setting up console message handling
            
            return None
        except Exception:
            return None


# Create a singleton renderer instance
_renderer = DiagramRenderer()


async def render_diagram(mermaid_code: str) -> RenderResult:
    """
    Render a Mermaid diagram.
    
    This is the main entry point for diagram rendering.
    
    Args:
        mermaid_code: Mermaid diagram code
        
    Returns:
        RenderResult with render_type and rendered_content
        
    Raises:
        ValueError: If diagram is invalid
        Exception: If rendering fails
    """
    if not mermaid_code or not mermaid_code.strip():
        raise ValueError("Mermaid code cannot be empty")
    
    return await _renderer.render(mermaid_code.strip())


async def render_as_image(mermaid_code: str) -> str:
    """
    Force render a diagram as an image.
    
    Useful for testing or when you specifically need an image.
    
    Args:
        mermaid_code: Mermaid diagram code
        
    Returns:
        Base64-encoded PNG data URL
    """
    renderer = DiagramRenderer()
    # Override config temporarily
    renderer.config.RENDER_MODE = "image"
    result = await renderer.render(mermaid_code)
    return result.rendered_content
