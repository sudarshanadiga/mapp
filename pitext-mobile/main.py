"""
PiText Mobile - Standalone mobile-optimized app.
"""

import logging
import sys
from pathlib import Path
import os
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Set up logger
logger = logging.getLogger(__name__)

logger.info("Shri Lakshmi Anantha Padmanabha")
# Configuration
class Config:
    def __init__(self):
        self.API_PREFIX = "/mobile"
        self.HOST = "0.0.0.0"
        self.PORT = 8000
        self.PROMPTS_DIR = Path(__file__).parent / "prompts"
        self.PUBLIC_DIR = Path(__file__).parent / "public"

def get_config():
    return Config()

# Pydantic models for API
class DescribeRequest(BaseModel):
    query: str

class DeepDiveRequest(BaseModel):
    selected_text: str
    question: str
    original_query: Optional[str] = ""

class DiagramResponse(BaseModel):
    query: str
    diagram: str
    content: Optional[str] = None
    diagram_type: Optional[str] = None

class DeepDiveResponse(BaseModel):
    response: str

class HealthResponse(BaseModel):
    status: str
    version: str

# Simple LLM service (placeholder - you can expand this)
class LLMService:
    def __init__(self):
        self.config = get_config()
        self.api_key = os.getenv("OPENAI_API_KEY")
        if self.api_key:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("OpenAI API key not found - using fallback responses")
    
    def _load_prompt(self, filename: str) -> str:
        """Load prompt from file."""
        prompt_path = self.config.PROMPTS_DIR / filename
        if not prompt_path.exists():
            logger.warning(f"Prompt file not found: {filename}")
            return ""
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            logger.error(f"Error loading prompt {filename}: {e}")
            return ""
    
    def _clean_diagram_code(self, code: str) -> str:
        """Clean diagram code from markdown code blocks and extra whitespace."""
        if not code:
            return code
        
        # Remove markdown code blocks
        code = code.strip()
        if code.startswith('```'):
            # Remove opening ```mermaid or ```
            lines = code.split('\n')
            if len(lines) > 1:
                # Skip the first line (```mermaid or ```)
                code = '\n'.join(lines[1:])
        
        if code.endswith('```'):
            # Remove closing ```
            code = code[:-3]
        
        # Clean up any remaining whitespace
        code = code.strip()
        
        # Additional validation - ensure it looks like Mermaid code
        if not any(keyword in code.lower() for keyword in ['flowchart', 'graph', 'sequencediagram', 'gantt', 'pie']):
            logger.warning(f"Generated code doesn't look like Mermaid: {code[:100]}...")
        
        # Log the cleaned code for debugging
        logger.info(f"Cleaned diagram code (first 200 chars): {code[:200]}...")
        
        return code
    
    async def _select_diagram_type(self, query: str) -> str:
        """Select diagram type using LLM (flowchart, radial_mindmap, sequence_comparison)."""
        if not self.client:
            return "radial_mindmap"
        selector_prompt = (
            "You are a diagram-type selector.\n"
            "As a response to the below query, choose which output representation would be best suited:\n"
            "- flowchart        : sequential steps, how-to, decision logic\n"
            "- radial_mindmap   : concept overviews, definitions, characteristics\n"
            "- sequence_comparison: comparing two or more items, highlighting similarities and unique features\n"
            "\nRespond with ONLY one word: 'flowchart', 'radial_mindmap', or 'sequence_comparison'."
        )
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": selector_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.3,
                max_tokens=10
            )
            content_raw = response.choices[0].message.content if response.choices and response.choices[0].message else None
            diagram_type = content_raw.strip().lower() if content_raw else ""
            if diagram_type not in {"flowchart", "radial_mindmap", "sequence_comparison"}:
                logger.warning(f"Invalid diagram type from LLM: {diagram_type}")
                return "radial_mindmap"
            return diagram_type
        except Exception as e:
            logger.error(f"Diagram type selection failed: {e}")
            return "radial_mindmap"

    async def generate_diagram(self, query: str) -> dict:
        """Generate a diagram from query, selecting diagram type and prompts appropriately."""
        if not self.client:
            fallback_diagram = f"flowchart TD\n    A[Start] --> B[Process]\n    B --> C[End]\n    %% Query: {query}"
            return {
                "diagram": self._clean_diagram_code(fallback_diagram),
                "content": f"Generated content for: {query}",
                "diagram_type": "radial_mindmap"
            }
        try:
            # Step 1: Select diagram type
            diagram_type = await self._select_diagram_type(query)

            # Step 2: Load content prompt
            if diagram_type == "sequence_comparison":
                content_prompt = self._load_prompt("content_sequence_comparison.txt")
                if not content_prompt:
                    content_prompt = "You are an expert at generating structured, concise comparison data for up to four items (such as languages, frameworks, or concepts).\n..."
            else:
                content_prompt = self._load_prompt("content.txt")
                if not content_prompt:
                    content_prompt = "You are an expert at creating concise, structured descriptions. When given a query, provide: ..."

            # Step 3: Generate content
            content_response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": content_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.7,
                max_tokens=500
            )
            content = content_response.choices[0].message.content
            if not content:
                raise ValueError("Empty content response from OpenAI")

            # Step 4: Load diagram prompt
            if diagram_type == "sequence_comparison":
                diagram_prompt = self._load_prompt("diagram_sequence_comparison.txt")
                if not diagram_prompt:
                    diagram_prompt = "You are a diagram-making assistant that creates Mermaid sequence diagrams for comparing between 2 and 4 items ..."
            elif diagram_type == "flowchart":
                diagram_prompt = self._load_prompt("diagram_flowchart.txt")
                if not diagram_prompt:
                    diagram_prompt = "You are a diagram‑making assistant that returns **only** Mermaid flowchart code representing the process described. ..."
            else:
                diagram_prompt = self._load_prompt("diagram.txt")
                if not diagram_prompt:
                    diagram_prompt = "You are a diagram-making assistant that creates flowcharts, which are structured like radial mind-maps. ..."

            # Step 5: Generate diagram code
            if diagram_type == "sequence_comparison":
                user_message = f"Create a Mermaid sequence diagram for this comparison query:\n\n{query}\n\nContent details:\n{content}"
            elif diagram_type == "flowchart":
                user_message = f"Create a Mermaid flowchart that answers this query:\n\n{query}\n\nContent details:\n{content}"
            else:
                user_message = f"Create a radial Mermaid mind-map from this content:\n{content}"

            diagram_response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": diagram_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            diagram_code = diagram_response.choices[0].message.content
            if not diagram_code:
                raise ValueError("Empty diagram response from OpenAI")

            cleaned_diagram = self._clean_diagram_code(diagram_code)
            logger.info(f"Generated diagram code (first 200 chars): {cleaned_diagram[:200]}...")

            content = content if content is not None else ""
            return {
                "diagram": cleaned_diagram,
                "content": content.strip(),
                "diagram_type": diagram_type
            }
        except Exception as e:
            logger.error(f"Diagram generation failed: {e}")
            fallback_diagram = f"flowchart TD\n    A[Start] --> B[Process]\n    B --> C[End]\n    %% Query: {query}"
            return {
                "diagram": self._clean_diagram_code(fallback_diagram),
                "content": f"Generated content for: {query}",
                "diagram_type": "radial_mindmap"
            }
    
    async def generate_deep_dive(self, selected_text: str, question: str, original_query: Optional[str] = "") -> str:
        """Generate deep dive response."""
        if not self.client:
            # Fallback response
            return f"Deep dive response for '{selected_text}' regarding '{question}'. Original query was: {original_query or ''}"
        
        try:
            # Load the deep dive prompt
            system_prompt = self._load_prompt("deep_dive.txt")
            if not system_prompt:
                # Fallback prompt
                system_prompt = """You are a helpful assistant that provides detailed explanations about selected content from diagrams. 
                Provide clear, informative responses that directly answer the user's question."""
            
            user_prompt = f"Selected text: {selected_text}\nQuestion: {question}"
            if original_query:
                user_prompt += f"\nOriginal query: {original_query}"
            
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            response_content = response.choices[0].message.content
            if not response_content:
                raise ValueError("Empty response from OpenAI")
            
            return response_content.strip()
        except Exception as e:
            logger.error(f"Deep dive generation failed: {e}")
            # Fallback response
            return f"Deep dive response for '{selected_text}' regarding '{question}'. Original query was: {original_query or ''}"

# API routes
from fastapi import APIRouter

router = APIRouter(prefix="/mobile")

@router.post("/describe", response_model=DiagramResponse)
async def describe(request: DescribeRequest):
    """Generate a diagram from a text query."""
    try:
        logger.info("Processing describe request: %s...", request.query[:50])
        llm_service = LLMService()
        result = await llm_service.generate_diagram(request.query)
        return DiagramResponse(query=request.query, **result)
    except Exception as exc:
        logger.error("Error in describe: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/deep-dive", response_model=DeepDiveResponse)
async def deep_dive(request: DeepDiveRequest):
    """Generate an explanatory answer about selected diagram content."""
    try:
        logger.info("Deep-dive request - Text: %s..., Question: %s...", 
                   request.selected_text[:30], request.question[:50])
        
        llm_service = LLMService()
        response = await llm_service.generate_deep_dive(
            request.selected_text, 
            request.question, 
            request.original_query
        )
        
        return DeepDiveResponse(response=response)
        
    except Exception as exc:
        logger.error("Error in deep-dive: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health-check endpoint."""
    return HealthResponse(status="healthy", version="1.0.0")

def setup_middleware(app: FastAPI):
    """Setup middleware for the app."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

def setup_mobile_static_routes(app: FastAPI):
    """Register static-file mounts for the mobile front-end."""
    config = get_config()
    
    app.mount(
        f"{config.API_PREFIX}/assets",
        StaticFiles(directory=str(Path(__file__).parent / "public" / "assets")),
        name="mobile_assets",
    )
    app.mount(
        f"{config.API_PREFIX}/js",
        StaticFiles(directory=str(Path(__file__).parent / "public" / "js")),
        name="mobile_js",
    )
    app.mount(
        f"{config.API_PREFIX}/css",
        StaticFiles(directory=str(Path(__file__).parent / "public" / "css")),
        name="mobile_css",
    )

    @app.get(config.API_PREFIX)
    @app.get(f"{config.API_PREFIX}/")
    async def mobile_root():
        """Serve the main mobile application."""
        index_path = Path(__file__).parent / "public" / "index.html"
        if not index_path.exists():
            logger.error("Mobile index.html not found at %s", index_path)
            raise HTTPException(
                status_code=500, detail="Mobile application files not found"
            )
        return FileResponse(index_path)

    @app.get(f"{config.API_PREFIX}/{{path:path}}")
    async def mobile_catch_all(path: str):
        """Client-side routing fall-back for mobile app."""
        mobile_file_path = Path(__file__).parent / "public" / path
        if mobile_file_path.exists() and mobile_file_path.is_file():
            return FileResponse(mobile_file_path)

        # If no file found, serve the mobile index.html for client-side routing
        mobile_index_path = Path(__file__).parent / "public" / "index.html"
        if mobile_index_path.exists():
            return FileResponse(mobile_index_path)

        raise HTTPException(status_code=404, detail="Not found")

def setup_logging():
    """Configure application logging."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    config = get_config()

    app = FastAPI(
        title="PiText Mobile",
        description="Mobile-optimized code generation and Mermaid diagram creator",
        version="0.1.0",
    )

    # Middleware
    setup_middleware(app)

    # Mount static files
    setup_mobile_static_routes(app)

    # API routes
    app.include_router(router)

    # Root redirect
    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return RedirectResponse(url=config.API_PREFIX or "/mobile")

    return app

def main():
    setup_logging()
    config = get_config()

    app = create_app()

    logging.info(f"PiText Mobile running at http://{config.HOST}:{config.PORT}")

    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )

app = create_app()

# Add asgi_app variable for router compatibility
asgi_app = app

if __name__ == "__main__":
    main() 