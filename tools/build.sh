#!/bin/bash  
if [ -d ../app/build ] ; then 
	rm -rf build/
fi
../tools/node_modules/nw-builder/bin/nwbuild -v 0.12.3 -p "osx64,linux64" .
