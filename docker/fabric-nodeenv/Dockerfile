# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
ARG NODE_IMAGE_TAG=24-alpine
FROM node:${NODE_IMAGE_TAG}
RUN apk add --no-cache \
	make \
	python3 \
	g++
RUN mkdir -p /chaincode/input \
	&& mkdir -p /chaincode/output \
	&& mkdir -p /usr/local/src
ADD build.sh start.sh /chaincode/
