#!/bin/bash
set -e  # Stop script if any command fails

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Config
REGISTRY="registry.godrivex.in"
APP_NAME="wacrm"
ENV=${1:-"dev"}
TAG=${2:-"latest"}
IMAGE_TAG="${REGISTRY}/${APP_NAME}-${ENV}:${TAG}"

# Detect architecture
PLATFORM_FLAG=""
ARCH=$(uname -m)

if [[ "$ARCH" == "arm64" ]] || [[ "$ARCH" == "aarch64" ]]; then
    PLATFORM_FLAG="--platform linux/amd64"
fi

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Building ${APP_NAME} for ${ENV} with tag: ${TAG}${NC}"
echo -e "${GREEN}Target image: ${IMAGE_TAG}${NC}"
echo -e "${GREEN}Detected architecture: ${ARCH}${NC}"
echo -e "${GREEN}================================================${NC}"

# Load build-time NEXT_PUBLIC_* variables from .env.local if present
# (Next.js inlines NEXT_PUBLIC_* into client bundles during build)
ENV_FILE=".env.local"

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Reading build-time variables from ${ENV_FILE}...${NC}"
    NEXT_PUBLIC_SUPABASE_URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n')
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n')
    NEXT_PUBLIC_SITE_URL=$(grep -E '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n')
    NEXT_PUBLIC_APP_LOCALE=$(grep -E '^NEXT_PUBLIC_APP_LOCALE=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"\r\n')
fi

# Fallback defaults
NEXT_PUBLIC_APP_LOCALE=${NEXT_PUBLIC_APP_LOCALE:-"en"}

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in ${ENV_FILE}.${NC}"
    echo -e "${YELLOW}Next.js build requires these to prerender pages. Ensure they are configured.${NC}"
fi

BUILD_ARGS="--build-arg NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
--build-arg NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
--build-arg NEXT_PUBLIC_APP_LOCALE=${NEXT_PUBLIC_APP_LOCALE}"

echo -e "${GREEN}Building Docker image...${NC}"
docker build $PLATFORM_FLAG $BUILD_ARGS -t "$IMAGE_TAG" .

echo -e "${GREEN}Pushing image to ${REGISTRY}...${NC}"
docker push "$IMAGE_TAG"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Successfully built and pushed: ${IMAGE_TAG}${NC}"
echo -e "${GREEN}================================================${NC}"
