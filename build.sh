#!/usr/bin/env bash
# Multi-platform from M1/M2/M3:$ DOCKER_ARGS="--platform linux/amd64,linux/arm64 -t digiserve/ab-appbuilder:master --push" ./build.sh
# (One-time: $ docker buildx create --use)

git submodule update --init --recursive

docker buildx build $DOCKER_ARGS .
