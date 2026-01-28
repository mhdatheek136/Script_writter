"""
AWS S3 storage service for file management.
Handles upload, download, and presigned URL generation.
"""
import os
import logging
from typing import Optional, BinaryIO
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)


class S3StorageService:
    """
    Service for interacting with AWS S3.
    Provides methods for file upload, download, and secure URL generation.
    """

    def __init__(self):
        """Initialize S3 client with environment credentials."""
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.region = os.getenv("AWS_REGION", "ap-south-1")
        self.bucket_name = os.getenv("S3_BUCKET", "script-writer-media")
        
        self._client = None
        self._initialized = False

    @property
    def client(self):
        """Lazy initialization of S3 client."""
        if self._client is None:
            if not self.access_key or not self.secret_key:
                logger.warning("AWS credentials not configured. S3 operations will fail.")
                return None
            
            try:
                self._client = boto3.client(
                    "s3",
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region
                )
                self._initialized = True
                logger.info(f"S3 client initialized for bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")
                return None
        
        return self._client

    def is_configured(self) -> bool:
        """Check if S3 is properly configured."""
        return bool(self.access_key and self.secret_key and self.bucket_name)

    def get_s3_key(self, user_id: str, project_id: str, file_type: str, filename: str) -> str:
        """
        Generate consistent S3 key structure.
        
        Structure: users/{user_id}/projects/{project_id}/{file_type}/{filename}
        """
        return f"users/{user_id}/projects/{project_id}/{file_type}/{filename}"

    def upload_file(
        self,
        file_content: bytes,
        s3_key: str,
        content_type: str = "application/octet-stream"
    ) -> bool:
        """
        Upload a file to S3.
        
        Args:
            file_content: File content as bytes
            s3_key: S3 key (path) for the file
            content_type: MIME type of the file
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return False
        
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type
            )
            logger.info(f"Uploaded file to S3: {s3_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to upload to S3: {e}")
            return False

    def upload_file_obj(
        self,
        file_obj: BinaryIO,
        s3_key: str,
        content_type: str = "application/octet-stream"
    ) -> bool:
        """
        Upload a file object to S3.
        
        Args:
            file_obj: File-like object
            s3_key: S3 key (path) for the file
            content_type: MIME type of the file
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return False
        
        try:
            self.client.upload_fileobj(
                file_obj,
                self.bucket_name,
                s3_key,
                ExtraArgs={"ContentType": content_type}
            )
            logger.info(f"Uploaded file object to S3: {s3_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to upload file object to S3: {e}")
            return False

    def download_file(self, s3_key: str) -> Optional[bytes]:
        """
        Download a file from S3.
        
        Args:
            s3_key: S3 key (path) of the file
            
        Returns:
            File content as bytes, or None if failed
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return None
        
        try:
            response = self.client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            content = response["Body"].read()
            logger.info(f"Downloaded file from S3: {s3_key}")
            return content
        except ClientError as e:
            logger.error(f"Failed to download from S3: {e}")
            return None

    def download_to_file(self, s3_key: str, local_path: Path) -> bool:
        """
        Download a file from S3 to a local path.
        
        Args:
            s3_key: S3 key (path) of the file
            local_path: Local file path to save to
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return False
        
        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            self.client.download_file(
                self.bucket_name,
                s3_key,
                str(local_path)
            )
            logger.info(f"Downloaded file from S3 to: {local_path}")
            return True
        except ClientError as e:
            logger.error(f"Failed to download file to local path: {e}")
            return False

    def generate_presigned_url(
        self,
        s3_key: str,
        expiration: int = 3600,
        http_method: str = "get_object"
    ) -> Optional[str]:
        """
        Generate a presigned URL for secure file access.
        
        Args:
            s3_key: S3 key (path) of the file
            expiration: URL expiration time in seconds (default: 1 hour)
            http_method: S3 method (get_object or put_object)
            
        Returns:
            Presigned URL string, or None if failed
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return None
        
        try:
            url = self.client.generate_presigned_url(
                http_method,
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key
                },
                ExpiresIn=expiration
            )
            logger.debug(f"Generated presigned URL for: {s3_key}")
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None

    def delete_file(self, s3_key: str) -> bool:
        """
        Delete a file from S3.
        
        Args:
            s3_key: S3 key (path) of the file
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return False
        
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f"Deleted file from S3: {s3_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete from S3: {e}")
            return False

    def delete_prefix(self, prefix: str) -> bool:
        """
        Delete all files with a given prefix (folder-like delete).
        
        Args:
            prefix: S3 key prefix to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return False
        
        try:
            # List all objects with prefix
            paginator = self.client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            
            delete_objects = []
            for page in pages:
                if "Contents" in page:
                    for obj in page["Contents"]:
                        delete_objects.append({"Key": obj["Key"]})
            
            if delete_objects:
                # Delete in batches of 1000 (S3 limit)
                for i in range(0, len(delete_objects), 1000):
                    batch = delete_objects[i:i + 1000]
                    self.client.delete_objects(
                        Bucket=self.bucket_name,
                        Delete={"Objects": batch}
                    )
                logger.info(f"Deleted {len(delete_objects)} files with prefix: {prefix}")
            
            return True
        except ClientError as e:
            logger.error(f"Failed to delete prefix from S3: {e}")
            return False

    def list_files(self, prefix: str) -> list:
        """
        List all files with a given prefix.
        
        Args:
            prefix: S3 key prefix to list
            
        Returns:
            List of file keys
        """
        if not self.client:
            logger.error("S3 client not initialized")
            return []
        
        try:
            paginator = self.client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            
            files = []
            for page in pages:
                if "Contents" in page:
                    for obj in page["Contents"]:
                        files.append({
                            "key": obj["Key"],
                            "size": obj["Size"],
                            "last_modified": obj["LastModified"]
                        })
            
            return files
        except ClientError as e:
            logger.error(f"Failed to list files from S3: {e}")
            return []

    def file_exists(self, s3_key: str) -> bool:
        """
        Check if a file exists in S3.
        
        Args:
            s3_key: S3 key (path) of the file
            
        Returns:
            True if exists, False otherwise
        """
        if not self.client:
            return False
        
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False


# Singleton instance
_s3_service = None


def get_s3_service() -> S3StorageService:
    """Get or create the S3 storage service singleton."""
    global _s3_service
    if _s3_service is None:
        _s3_service = S3StorageService()
    return _s3_service
