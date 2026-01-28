"""
Projects router for project management.
"""
import logging
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.db_models import User, Project, AIOutput, FileRecord, UserRole
from app.services.s3_storage import get_s3_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["Projects"])


class CreateProjectRequest(BaseModel):
    """Request schema for creating a project."""
    name: str
    description: Optional[str] = None


class UpdateProjectRequest(BaseModel):
    """Request schema for updating a project."""
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """Project response schema."""
    id: str
    name: str
    description: Optional[str]
    created_at: str
    updated_at: str
    files_count: int = 0
    outputs_count: int = 0


class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with files and outputs."""
    files: List[dict] = []
    outputs: List[dict] = []


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all projects for the current user.
    Everyone only sees their own projects.
    """
    projects = db.query(Project).filter(
        Project.user_id == current_user.id
    ).order_by(Project.updated_at.desc()).all()
    
    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at.isoformat(),
            updated_at=project.updated_at.isoformat(),
            files_count=len(project.files),
            outputs_count=len(project.ai_outputs)
        )
        for project in projects
    ]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new project.
    """
    logger.info(f"User {current_user.email} creating project: {request.name}")
    
    project = Project(
        user_id=current_user.id,
        name=request.name,
        description=request.description
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    logger.info(f"Project created: {project.id}")
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        files_count=0,
        outputs_count=0
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific project with all its files and outputs.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build file list
    files = [
        {
            "id": f.id,
            "file_type": f.file_type.value,
            "original_filename": f.original_filename,
            "size_bytes": f.size_bytes,
            "created_at": f.created_at.isoformat()
        }
        for f in project.files
    ]
    
    # Build output list
    outputs = [
        {
            "id": o.id,
            "version": o.version,
            "is_approved": o.is_approved,
            "config_used": o.config_used,
            "created_at": o.created_at.isoformat()
        }
        for o in sorted(project.ai_outputs, key=lambda x: x.version, reverse=True)
    ]
    
    return ProjectDetailResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        files_count=len(files),
        outputs_count=len(outputs),
        files=files,
        outputs=outputs
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a project (rename, change description).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update fields
    if request.name:
        project.name = request.name
    if request.description is not None:
        project.description = request.description
    
    db.commit()
    db.refresh(project)
    
    logger.info(f"Project updated: {project.id}")
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        files_count=len(project.files),
        outputs_count=len(project.ai_outputs)
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a project and all its files from S3.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    logger.info(f"Deleting project: {project.id}")
    
    # Delete files from S3
    s3 = get_s3_service()
    if s3.is_configured():
        prefix = f"users/{project.user_id}/projects/{project.id}/"
        s3.delete_prefix(prefix)
    
    # Delete from database (cascade will delete files and outputs)
    db.delete(project)
    db.commit()
    
    return {"message": f"Project '{project.name}' deleted successfully"}


@router.get("/{project_id}/outputs/{output_id}")
async def get_output(
    project_id: str,
    output_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific AI output with full slide data.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    output = db.query(AIOutput).filter(
        AIOutput.id == output_id,
        AIOutput.project_id == project_id
    ).first()
    
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output not found"
        )
    
    return {
        "id": output.id,
        "project_id": output.project_id,
        "version": output.version,
        "slides_data": output.slides_data,
        "config_used": output.config_used,
        "is_approved": output.is_approved,
        "created_at": output.created_at.isoformat()
    }


@router.put("/{project_id}/outputs/{output_id}/approve")
async def approve_output(
    project_id: str,
    output_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark an AI output as approved (final version).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check access
    if project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    output = db.query(AIOutput).filter(
        AIOutput.id == output_id,
        AIOutput.project_id == project_id
    ).first()
    
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output not found"
        )
    
    # Unapprove all other outputs for this project
    db.query(AIOutput).filter(
        AIOutput.project_id == project_id,
        AIOutput.id != output_id
    ).update({"is_approved": False})
    
    # Approve this output
    output.is_approved = True
    db.commit()
    
    return {"message": f"Output v{output.version} approved"}
