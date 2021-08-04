KOKKOS_DIR=/home/pvelesko/local/tarballs/kokkos/build_latest/install
KOKKOS_LIB=${KOKKOS_DIR}/lib
KOKKOS_INC=${KOKKOS_DIR}/include

#OMP_LIB=/soft/restricted/intel_dga/sdk/2019.11.15.015/compiler/latest/linux/compiler/include

driver: main.cpp
	#icpc -std=c++11 --expt-extended-lambda  main.cpp -qopenmp  -I${KOKKOS_INC} -L${KOKKOS_LIB} -lkokkos -o driver
	icpc -std=c++11 main.cpp -qopenmp  -I${KOKKOS_INC} -L${KOKKOS_LIB} -lkokkos -o driver
