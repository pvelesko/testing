all:
	clang++ -fopenmp -fopenmp-targets=nvptx64-nvidia-cuda -Xopenmp-target -march=sm_60  ./one_plus_one.cpp -o one_plus_one

clean:
	rm ./one_plus_one
