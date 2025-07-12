# services/llm/codegen.py
"""
Core code generation logic using the LLM.
"""

import logging
from typing import Dict
from pitext_codegen.services.llm.client import get_llm_client
from pitext_codegen.services.llm.prompts import get_prompt_manager
from pitext_codegen.core.sanitizer import sanitize_mermaid

logger = logging.getLogger(__name__)


def _get_extension(language: str) -> str:
    """Get file extension for the given language."""
    extensions = {
        "python": "py",
        "javascript": "js",
        "typescript": "ts",
        "go": "go",
        "rust": "rs",
        "java": "java",
        "cpp": "cpp",
        "c": "c"
    }
    return extensions.get(language.lower(), "txt")

async def generate_mermaid_direct(prompt: str) -> str:
    """Generate Mermaid flowchart directly from user prompt."""
    logger.info("Starting generate_mermaid_direct")
    client = get_llm_client()
    logger.info("Got LLM client")
    prompt_manager = get_prompt_manager()
    logger.info(f"Got prompt manager: {prompt_manager}")
    logger.info(f"Available prompt keys: {list(prompt_manager.PROMPT_FILES.keys())}")
    
    system_prompt = prompt_manager.get("mermaid_generator")
    logger.info("Got system prompt")
    
    response = await client.generate_with_system(
        system_prompt=system_prompt,
        user_prompt=prompt,
        temperature=0.3,
        max_tokens=1000,
    )
    return sanitize_mermaid(response)

async def generate_single_code_file(prompt: str, diagram: str, language: str) -> Dict[str, str]:
    """Generate a single complete code file from prompt + diagram."""
    client = get_llm_client()
    prompt_manager = get_prompt_manager()
    system_prompt = prompt_manager.get("code").format(language=language)
    user_content = f"## Requirement\n{prompt}\n\n## Architecture Diagram\n{diagram}"
    
    response = await client.generate_with_system(
        system_prompt=system_prompt,
        user_prompt=user_content,
        temperature=0.5,
        max_tokens=2500,
    )
    
    # Parse the response to extract the single file
    files = {}
    lines = response.splitlines()
    current_path = None
    current_lines = []
    
    for line in lines:
        if line.startswith("```") and not current_path:
            parts = line.strip("` ").split()
            current_path = parts[0] if parts and "." in parts[0] else f"main.{_get_extension(language)}"
        elif line.startswith("```") and current_path:
            files[current_path] = "\n".join(current_lines) + "\n"
            current_path, current_lines = None, []
        elif current_path:
            current_lines.append(line)
    
    # If no code blocks found, use entire content as a single file
    if not files and response:
        filename = f"main.{_get_extension(language)}"
        files[filename] = response

    return files

async def deepdive_node(node_name: str, original_prompt: str, flowchart: str, question: str) -> str:
    """Generate detailed explanation for a specific flowchart node."""
    client = get_llm_client()
    prompt_manager = get_prompt_manager()
    system_prompt = prompt_manager.get("deepdive")
    
    user_content = f"""## Original Requirement
{original_prompt}

## Flowchart Context
{flowchart}

## Specific Node to Explain
{node_name}

## User's Question
{question}

Please provide a detailed technical explanation for the "{node_name}" component, directly answering the user's question in the context of the overall system."""
    
    response = await client.generate_with_system(
        system_prompt=system_prompt,
        user_prompt=user_content,
        temperature=0.7,
        max_tokens=600,
    )
    return response