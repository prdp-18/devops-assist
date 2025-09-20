# Multi-stage Dockerfile for AWS Lambda Python function
# Stage 1: Build dependencies
FROM public.ecr.aws/lambda/python:3.9 as builder

# Copy requirements file
COPY requirements.txt ${LAMBDA_TASK_ROOT}/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Final image
FROM public.ecr.aws/lambda/python:3.9

# Copy installed packages from builder stage
COPY --from=builder ${LAMBDA_TASK_ROOT}/lib/python3.9/site-packages/ ${LAMBDA_TASK_ROOT}/lib/python3.9/site-packages/

# Copy application code
COPY main.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to the handler function
CMD ["main.handler"]
