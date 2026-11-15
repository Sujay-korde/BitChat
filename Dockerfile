FROM python:3.13-slim

WORKDIR /app

# Install project and dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application source
COPY src/ ./src/

ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "-m", "securechat.server.main"]

