#!/bin/bash

sudo ls > /dev/null && # early prompt for sudo password

if [[ $(whoami) == $(sudo whoami) ]] ; then
    echo "you shouldn't run me with root"
    exit 1
fi

(cd server/ && npm run start) &&

(cd client/ && tmux new-session -A -s hotreload "npm run start")
