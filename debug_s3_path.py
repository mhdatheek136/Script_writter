import os
import sys
from pathlib import Path

# Mock dependencies
from dotenv import load_dotenv
load_dotenv(override=True)

try:
    from app.services.s3_storage import S3StorageService
except ImportError:
    # Fix import path
    sys.path.append(str(Path.cwd()))
    from app.services.s3_storage import S3StorageService

def test_path_generation():
    print("Testing S3 Path Generation...")
    service = S3StorageService()
    
    user_id = 999
    project_id = "test-project-123"
    prefix = "uploads"
    filename = "test_presentation.pptx"
    
    # Manually recreate logic from S3StorageService.upload_file if not accessible
    # But better to inspect the class method or run a mock upload if possible
    
    key = f"users/{user_id}/projects/{project_id}/{prefix}/{filename}"
    print(f"Expected Key: {key}")
    
    if service.is_configured():
        print(f"Bucket: {service.bucket_name}")
        print("Attempting dry-run upload (creating dummy file)...")
        
        dummy_file = Path("/tmp/debug_dummy.pptx")
        dummy_file.write_text("dummy content")
        
        try:
            uploaded_key = service.upload_file(
                dummy_file,
                user_id,
                project_id,
                prefix,
                filename
            )
            print(f"Start Upload -> Returned Key: {uploaded_key}")
            
            if uploaded_key == key:
                print("SUCCESS: Key matches expectation.")
            else:
                print("FAILURE: Key mismatch!")
                
            # Clean up
            print("Cleaning up S3 file...")
            service.delete_file(uploaded_key)
            
        except Exception as e:
            print(f"Upload failed: {e}")
        finally:
            if dummy_file.exists():
                dummy_file.unlink()
    else:
        print("S3 not configured.")

if __name__ == "__main__":
    test_path_generation()
