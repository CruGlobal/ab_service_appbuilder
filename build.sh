#!/usr/bin/env bash
# Multi-platform from M1/M2/M3:$ DOCKER_ARGS="--platform linux/amd64,linux/arm64 -t digiserve/ab-appbuilder:master --push" ./build.sh
# (One-time: $ docker buildx create --use)
# Supply chain: --provenance and --sbom are required for Docker Hub attestations; they are preserved when using --push.

git submodule update --init --recursive

docker buildx build --provenance=true --sbom=true $DOCKER_ARGS .
