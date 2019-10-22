# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
ARG NODE_VER=12.13.0
FROM node:${NODE_VER}-alpine
RUN apk add --no-cache \
	make \
	python \
	g++;
RUN mkdir -p /chaincode/input \
	&& mkdir -p /chaincode/output \
	&& mkdir -p /usr/local/src;
ADD build.sh start.sh /chaincode/