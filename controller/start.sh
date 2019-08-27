#!/bin/sh

case $1 in
  controller) exec /bin/flynn-controller ;;
  controller-grpc) exec /bin/flynn-controller-grpc ;;
  scheduler)  exec /bin/flynn-scheduler ;;
  worker)  exec /bin/flynn-worker ;;
  *)
    echo "Usage: $0 {controller|controller-grpc|scheduler|worker}"
    exit 2
    ;;
esac
