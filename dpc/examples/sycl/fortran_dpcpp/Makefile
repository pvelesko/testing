IFORT=/soft/compilers/intel-2019/compilers_and_libraries/linux/lib/intel64_lin

all: fmain.o hello.o
	dpcpp ./fmain.o hello.o -o test_fortran -L${IFORT} -lifcore -lintlc ${IFORT}/for_main.o

fmain.o: fmain.f90
	ifort -c fmain.f90

hello.o: hello.cpp
	dpcpp -c hello.cpp

clean:
	rm -f test_fortran *.o 
