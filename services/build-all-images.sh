#!/bin/bash
# build-all-images.sh
# Builds Docker images for every IncidentOps service using Spring Boot's
# Cloud Native Buildpacks integration (no Dockerfile needed).
#
# Uses the Paketo Jammy Base builder.
#
# Prerequisite: Docker Desktop must be running.
#
# Run from: services/

set -e

BUILDER="paketobuildpacks/builder-jammy-base:latest"

echo "Pulling Paketo Jammy builder..."
docker pull "$BUILDER"

echo "Installing parent POM + common module into local .m2 repo..."
mvn -q -N install -f pom.xml
mvn -q install -f common/pom.xml -DskipTests

SERVICES=(
    discovery-server
    config-server
    api-gateway
    auth-service
    org-service
    user-service
    alert-ingestion-service
    incident-service
    workflow-service
    notification-service
    chat-service
    analytics-service
    auditor-service
)

for svc in "${SERVICES[@]}"; do
    echo ""
    echo "=== Building image for $svc ==="
    mvn -f "$svc/pom.xml" \
        spring-boot:build-image \
        -DskipTests \
        -Dspring-boot.build-image.builder="$BUILDER"
done

echo ""
echo "All images built successfully."
echo "Verify with:"
echo "docker images"