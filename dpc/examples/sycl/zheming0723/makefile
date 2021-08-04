.PHONY: clean all 

intel: main.cpp
	clang++ -fsycl -lsycl -lOpenCL -lstdc++ ./main.cpp -o intel

clean:
	rm ./sycl_test_*
