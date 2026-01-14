
class RefineRequest(BaseModel):
    current_text: str
    instruction: str
    slide_context: str
    tone: str = "Professional"

@app.post("/api/refine-narration")
async def refine_narration(request: RefineRequest):
    """
    Refine narration based on user instruction (JSON).
    """
    try:
        logger.info(f"=== NARRATION REFINE REQUEST ===")
        logger.info(f"Instruction: {request.instruction}")
        
        if not request.instruction.strip():
            raise HTTPException(status_code=400, detail="Instruction cannot be empty")
            
        from app.services.llm_client import LLMClient
        llm_client = LLMClient(GEMINI_API_KEY, GEMINI_MODEL)
        
        # We reuse rewrite_narration but pass empty strings for unused fields
        # since the prompt handles them if they are missing/empty in a way
        # or we might need to adjust LLMClient to be more flexible, 
        # but rewrite_narration expects (current_narration, rewritten_content, speaker_notes, user_request, tone)
        
        # slide_context from frontend = "Slide X: [content]"
        # We can pass this as rewritten_content to give context
        
        new_narration = llm_client.rewrite_narration(
            current_narration=request.current_text,
            rewritten_content=request.slide_context, # Passing context here
            speaker_notes="",
            user_request=request.instruction,
            tone=request.tone
        )
        
        return JSONResponse({
            "success": True,
            "refined_text": new_narration
        })
        
    except Exception as e:
        logger.error(f"Refine failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
