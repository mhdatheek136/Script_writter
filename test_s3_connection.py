import os
import sys

# Add app to path
sys.path.append('/app')

from app.services.s3_storage import S3StorageService
from app.database import SessionLocal
import boto3
from botocore.exceptions import ClientError

def test_s3():
    print("Testing S3 Connection...")
    
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("S3_BUCKET")
    region = os.getenv("AWS_REGION")
    
    print(f"Configuration:")
    print(f"  Bucket: {bucket_name}")
    print(f"  Region: {region}")
    
    if access_key:
        print(f"  Access Key Length: {len(access_key)}")
        if len(access_key) != 20:
             print(f"  WARNING: Access Key length is {len(access_key)}, expected 20. Check for invalid characters or spaces!")
             print(f"  Access Key (repr): {repr(access_key)}")
    else:
        print("  Access Key: Missing")

    if secret_key:
        print(f"  Secret Key Length: {len(secret_key)}")
    else:
        print("  Secret Key: Missing")
    
    if not access_key or not secret_key or not bucket_name:
        print("ERROR: Missing AWS credentials in environment variables.")
        return False

    try:
        s3_service = S3StorageService()
        
        # Test 1: Upload a simple file
        test_filename = "/tmp/test_connection.txt"
        test_content = b"This is a test file from Script Writer S3 verification."
        
        # Create a dummy file
        with open(test_filename, "wb") as f:
            f.write(test_content)
            
        print("\n[1/3] Attempting upload...")
        # Use a test key
        s3_key = "tests/test_connection.txt"
        
        # We need to manually call upload since s3_service.upload_file expects paths relative to user/project usually,
        # but let's see its signature.
        # upload_file(self, file_object, user_id, project_id, folder, original_filename)
        # OR upload_fileobj logic.
        
        # Let's try basic boto3 first to isolate issues, then service.
        s3_client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        
        s3_client.upload_file(test_filename, bucket_name, s3_key)
        print("  Basic boto3 upload successful!")
        
        # Test 2: Check with Service
        print("\n[2/3] Verifying with S3StorageService...")
        # Clean up
        try:
            url = s3_service.generate_presigned_url(s3_key)
            print(f"  Generated presigned URL: {url[:50]}...")
        except Exception as e:
             print(f"  Service check failed: {e}")
             raise

        # Test 3: Cleanup
        print("\n[3/3] Cleaning up...")
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
        print("  Cleanup successful!")
        
        print("\nSUCCESS: S3 bucket is accessible and working correctly.")
        return True
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        print(f"\nAWS Error Code: {error_code}")
        print(f"Message: {e}")
        
        if error_code == 'NoSuchBucket':
            print("\nError: The specified bucket does not exist.")
            try:
                print("Attempting to list available buckets...")
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region
                )
                response = s3_client.list_buckets()
                buckets = [b['Name'] for b in response.get('Buckets', [])]
                print(f"Available buckets: {', '.join(buckets)}")
            except Exception as le:
                print(f"Could not list buckets: {le}")
        
        return False
    except Exception as e:
        print(f"\nUnexpected Error: {type(e).__name__}: {e}")
        return False
    finally:
        if os.path.exists("/tmp/test_connection.txt"):
            os.remove("/tmp/test_connection.txt")

if __name__ == "__main__":
    if test_s3():
        sys.exit(0)
    else:
        sys.exit(1)
