##
## digiserve/ab-appbuilder:master
##
## This is our microservice for our AppBuilder CRUD operations.
##
## Security: image runs as non-root user `appbuilder`. For production, prefer
## pinning the base image by digest and overriding CMD to remove --inspect.
##
## Docker Commands:
## ---------------
## $ docker build -t digiserve/ab-appbuilder:master .
## $ docker push digiserve/ab-appbuilder:master
##
## Multi-platform (M1/M2/M3 Mac → amd64 + arm64):
## $ docker buildx create --use  # once, if no builder
## $ docker buildx build --platform linux/amd64,linux/arm64 -t digiserve/ab-appbuilder:master --push .
## Or use: $ DOCKER_ARGS="--platform linux/amd64,linux/arm64 --push" ./build.sh
##

ARG BRANCH=master

FROM digiserve/service-cli:${BRANCH}

# Run as non-root to limit impact of compromise
RUN groupadd -r appbuilder && useradd -r -g appbuilder -d /app -s /sbin/nologin -c "AppBuilder service" appbuilder

COPY . /app

WORKDIR /app

RUN npm i -f

WORKDIR /app/AppBuilder

RUN npm i -f

WORKDIR /app

RUN chown -R appbuilder:appbuilder /app

USER appbuilder

# --inspect=0.0.0.0:9229 exposes debugger to the network; omit in production or bind to 127.0.0.1
CMD [ "node", "--inspect=0.0.0.0:9229", "--max-old-space-size=8192", "--stack-size=8192", "app.js" ]
