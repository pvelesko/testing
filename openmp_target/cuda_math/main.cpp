//#include <cstdlib>
//#include <__clang_cuda_cmath.h>
#include <math.h>
int test() {

  float test;
  //float test = abs(-1);
#pragma omp target
  for (int i = 0; i < 10; i++) {
    test = sqrtf(-1);
  }
  return 0;
}
