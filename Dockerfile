FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (LibreOffice for soffice + poppler-utils for pdftoppm fallback)
RUN apt-get update && apt-get install -y \
    libreoffice \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY static/ ./static/

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
