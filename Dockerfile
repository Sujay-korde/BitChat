FROM python:3.13-slim

WORKDIR /app

# Copy project files and source
COPY pyproject.toml README.md ./
COPY src/ ./src/

# Install dependencies and project
RUN pip install --no-cache-dir .

ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "-m", "securechat.server.main"]
