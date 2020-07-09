#!/bin/bash

PATH_LOG="$HOME/<path>/execution.log"
VERSION_NODE=$1
PROJECT=$2
ENV=$3
PATH_PROJECT=$4

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

export PATH=$PATH:$NVM_DIR
ls -lrt ~/.nvm/nvm.sh
source ~/.nvm/nvm.sh
echo $NVM_DIR >> $PATH_LOG 2>&1

nvm install $VERSION_NODE >> $PATH_LOG 2>&1
nvm version >> $PATH_LOG 2>&1
nvm use $VERSION_NODE >> $PATH_LOG 2>&1

echo "Building project $PROJECT on environment $ENV" >> $PATH_LOG 2>&1
echo "Path changed on bash: $PATH_PROJECT" >> $PATH_LOG 2>&1
cd $PATH_PROJECT

cmd="npm i"
echo "-- exec cmd $cmd ---"
eval $cmd >> $PATH_LOG 2>&1

case $PROJECT in
      admin) 
         cmd="npm run build-$ENV"
         echo "-- exec cmd $cmd ---"
         eval $cmd >> $PATH_LOG 2>&1
      ;;
      app)
         cmd="npm run build:web:$ENV"
	 echo "-- exec cmd $cmd ---"
         eval $cmd >> $PATH_LOG 2>&1
      ;;
      *)
         echo "No project to build" >> $PATH_LOG 2>&1
      ;;
  esac


