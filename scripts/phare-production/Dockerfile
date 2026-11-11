# CPU worker only; deploying or starting a paid job requires separate authorization.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 phare
WORKDIR /app
COPY worker.py /app/worker.py
USER phare
ENTRYPOINT ["python", "/app/worker.py"]
