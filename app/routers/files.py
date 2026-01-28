"""
Files router for file upload and download management.
"""
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session
import io

from app.database import get_db
from app.auth.dependencies import get_current_user, get_current_user_query
from app.models.db_models import User, Project, FileRecord, FileType, UserRole
from app.services.s3_storage import get_s3_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/files", tags=["Files"])

# Max file size (50 MB)
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/upload/{project_id}")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    file_type: str = Form("original_ppt"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a file to a project.
    """
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if current_user.role != UserRole.ADMIN and project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Validate file type
    try:
        ft = FileType(file_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Must be one of: {[t.value for t in FileType]}"
        )
    
    # Read file content
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB"
        )
    
    # Determine content type
    content_type = file.content_type or "application/octet-stream"
    
    # Generate S3 key
    s3 = get_s3_service()
    file_id = str(uuid.uuid4())
    extension = Path(file.filename).suffix if file.filename else ""
    s3_key = s3.get_s3_key(
        project.user_id,
        project.id,
        file_type,
        f"{file_id}{extension}"
    )
    
    # Upload to S3
    if not s3.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage not configured"
        )
    
    success = s3.upload_file(content, s3_key, content_type)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file to storage"
        )
    
    # Create file record
    file_record = FileRecord(
        id=file_id,
        project_id=project.id,
        file_type=ft,
        s3_key=s3_key,
        original_filename=file.filename or "unknown",
        content_type=content_type,
        size_bytes=len(content)
    )
    
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    
    logger.info(f"File uploaded: {file_record.id} to project {project.id}")
    
    return {
        "id": file_record.id,
        "filename": file_record.original_filename,
        "file_type": file_record.file_type.value,
        "size_bytes": file_record.size_bytes,
        "created_at": file_record.created_at.isoformat()
    }


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a presigned URL to download a file.
    """
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Check access via project
    project = db.query(Project).filter(Project.id == file_record.project_id).first()
    if current_user.role != UserRole.ADMIN and project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Generate presigned URL
    s3 = get_s3_service()
    if not s3.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage not configured"
        )
    
    url = s3.generate_presigned_url(file_record.s3_key, expiration=3600)
    
    if not url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        )
    
    return {
        "download_url": url,
        "filename": file_record.original_filename,
        "expires_in": 3600
    }


@router.get("/{file_id}/content")
async def get_file_content(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream file content directly (for small files like images).
    """
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Check access via project
    project = db.query(Project).filter(Project.id == file_record.project_id).first()
    if current_user.role != UserRole.ADMIN and project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Download from S3
    s3 = get_s3_service()
    if not s3.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage not configured"
        )
    
    content = s3.download_file(file_record.s3_key)
    
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download file"
        )
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type=file_record.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file_record.original_filename}"'
        }
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a file from S3 and database.
    """
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Check access via project
    project = db.query(Project).filter(Project.id == file_record.project_id).first()
    if current_user.role != UserRole.ADMIN and project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Delete from S3
    s3 = get_s3_service()
    if s3.is_configured():
        s3.delete_file(file_record.s3_key)
    
    # Delete from database
    db.delete(file_record)
    db.commit()
    
    logger.info(f"File deleted: {file_id}")
    
    return {"message": "File deleted successfully"}


@router.get("/image/{project_id}/{session_id}/{filename}")
async def get_project_image(
    project_id: str,
    session_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_query)
):
    """
    Get presigned URL for a project image.
    Constructs key: users/{user_id}/projects/{project_id}/images/{session_id}/{filename}
    """
    # Check project access
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
         raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role != UserRole.ADMIN and project.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Access denied")

    s3 = get_s3_service()
    if not s3.is_configured():
         raise HTTPException(status_code=503, detail="S3 not configured")

    # Construct Key
    # consistent with SlideProcessor upload logic
    s3_key = f"users/{project.user_id}/projects/{project_id}/images/{session_id}/{filename}"
    
    # Generate URL
    url = s3.generate_presigned_url(s3_key, expiration=3600)
    
    if not url:
         raise HTTPException(status_code=404, detail="Image not found or S3 error")

    return RedirectResponse(url=url)
