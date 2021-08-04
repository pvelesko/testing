FC=ifort
FFLAGS=-g -ipo-c -qopt-report=5 -O3 -qopenmp -finline -finline-functions -fpp -inline-min-size=1 

%.o : %.f90
	$(FC) $(FFLAGS) -c $< -o $@

objfiles=my_module.o compute.o driver.o
	

all: driver

driver: $(objfiles)
	$(FC) -O3 -g -qopt-report=5 -qopenmp -o driver $(objfiles)

clean:
	rm *.o *.optrpt driver
