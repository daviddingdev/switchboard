FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends tmux curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Frontend build
COPY web/package.json web/package-lock.json web/
RUN cd web && npm install --silent

COPY web/ web/
RUN cd web && npm run build

# Copy the rest
COPY . .

# Create runtime directories
RUN mkdir -p state/proposals logs/workers

EXPOSE 5001

CMD ["python3", "api/server.py"]
