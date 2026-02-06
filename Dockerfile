##
## digiserve/ab-appbuilder:master
##
## This is our microservice for our AppBuilder CRUD operations.
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

COPY . /app

WORKDIR /app

RUN npm ci -f

WORKDIR /app/AppBuilder

RUN npm ci -f

WORKDIR /app

CMD [ "node", "--inspect=0.0.0.0:9229", "--max-old-space-size=8192", "--stack-size=8192", "app.js" ]
