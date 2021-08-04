#!/bin/bash
# Author : Gregg.Skinner@intel.com

#echo cat /sys/module/i915/parameters/enable_hangcheck; cat /sys/module/i915/parameters/enable_hangcheck
#sudo bash -c "echo N > /sys/module/i915/parameters/enable_hangcheck"
#echo ls /etc/OpenCL/vendors; ls /etc/OpenCL/vendors
#echo cat /etc/OpenCL/intel.icd; cat /etc/OpenCL/intel.icd
#echo ldconfig -p | grep libigdrcl; ldconfig -p | grep libigdrcl

#source /opt/intel/vtune_amplifier/amplxe-vars.sh

profiler=
#profiler="amplxe-cl -collect gpu-hotspots -result-dir ./gpu-hotspots-$$ --"
#profiler="amplxe-cl -collect gpu-profiling -knob gpu-profiling-mode=bblatency -knob kernels-to-profile=main -result-dir ./gpu-profiling-$$ --"
#profiler="amplxe-cl -collect gpu-profiling -knob gpu-profiling-mode=memlatency -knob kernels-to-profile=main -result-dir ./gpu-profiling-$$ --"
#profiler="amplxe-cl -collect gpu-profiling -knob gpu-profiling-mode=inscount -knob kernels-to-profile=main -result-dir ./gpu-profiling-$$ --"

export SYCL_DEVICE_TYPE=GPU
#export SYCL_DEVICE_TYPE=CPU
source /opt/intel/inteloneapi/setvars.sh; rm -rf miniFE.x; make clean; make -j 8
#export MAX_ITERS=1;(source /opt/intel/inteloneapi/setvars.sh; rm -rf miniFE.x; make clean; make -j 8)

#Collect AUB
export AUBDumpCaptureFileName=minife.aub
export SetCommandStreamReceiver=1 # toggle this to enable/disable AUB generation
export EnableLocalMemory=1
export ForcePreemptionMode=1
export ProductFamilyOverride=ats
export IGC_UseScratchSurface=1
export IGC_EnableOCLScratchPrivateMemory=0
export DoCpuCopyOnReadBuffer=1
export DoCpuCopyOnWriteBuffer=1
export RenderCompressedImagesEnabled=0
export RenderCompressedBuffersEnabled=0
export CreateMultipleDevices=1
export LimitAmountOfReturnedDevices=1
export HBMSizePerTileInGigabytes=8
# Use these for validating buffers using fulsim
#export AUBDumpImageFormat=BMP
#export AUBDumpBufferFormat=BIN

#clinfo

LD_LIBRARY_PATH=/opt/intel/inteloneapi/compiler/latest/linux/compiler/lib/intel64:$LD_LIBRARY_PATH
cp /opt/intel/inteloneapi/compiler/latest/linux/lib/libsycl.so .

#ldd ./miniFE.x
#$profiler ./miniFE.x nx=180
#$profiler ./miniFE.x nx=185
$profiler ./miniFE.x nx=50

rm -f *.so
