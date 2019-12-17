#!/bin/bash

set -eo pipefail

apt-get update
apt-get install --yes unzip python make
apt-get clean

# install protobuf compiler
pbversion="3.7.1"
shasum="24ea6924faaf94d4a0c5850fdb278290a326eff9a68f36ee5809654faccd0e10"
tmpdir=$(mktemp --directory)
trap "rm -rf ${tmpdir}" EXIT
curl -sL https://github.com/google/protobuf/releases/download/v${pbversion}/protoc-${pbversion}-linux-x86_64.zip > "${tmpdir}/protoc.zip"
echo "${shasum}  ${tmpdir}/protoc.zip" | shasum -c -
unzip -d "${tmpdir}/protoc" "${tmpdir}/protoc.zip"
mv "${tmpdir}/protoc" /opt
ln -s /opt/protoc/bin/protoc /usr/local/bin/protoc

# install googleapis common protos
shasum="9584b7ac21de5b31832faf827f898671cdcb034bd557a36ea3e7fc07e6571dcb"
curl -fSLo /tmp/common-protos.tar.gz "https://github.com/googleapis/googleapis/archive/common-protos-1_3_1.tar.gz"
echo "${shasum}  /tmp/common-protos.tar.gz" | shasum -c -
tar xzf /tmp/common-protos.tar.gz -C "/opt/protoc/include" --strip-components=1
rm /tmp/common-protos.tar.gz

# install nodejs
nodeversion="8.11.4"
nodeshasum="c69abe770f002a7415bd00f7ea13b086650c1dd925ef0c3bf8de90eabecc8790"
nodedir="/usr/local"
curl -fSLo /tmp/node.tar.gz "https://nodejs.org/dist/v${nodeversion}/node-v${nodeversion}-linux-x64.tar.gz"
echo "${nodeshasum}  /tmp/node.tar.gz" | shasum -c -
tar xzf /tmp/node.tar.gz -C "${nodedir}"
rm /tmp/node.tar.gz

# link nodejs binary
nodebin="${nodedir}/node-v${nodeversion}-linux-x64/bin"
ln -nfs ${nodebin}/node ${nodedir}/bin/node
ln -nfs ${nodebin}/npm ${nodedir}/bin/npm

# install typescript protoc (https://github.com/improbable-eng/ts-protoc-gen)
npm install -g google-protobuf@3.11.2 ts-protoc-gen@0.12.0

# install yarn
npm install -g yarn@1.21.1
