#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#

kill $(ps aux | awk '/--peer.address/ {print $1}')
kill $(ps aux | awk '/--peer.address/ {print $2}')