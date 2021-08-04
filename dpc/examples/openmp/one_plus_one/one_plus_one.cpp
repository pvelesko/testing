#include <iostream>
#include "CL/sycl.hpp"
#include <omp.h>
using namespace cl::sycl;
int main() {
  auto q = queue(gpu_selector{});
  int* num = static_cast<int*>(malloc_shared(3 * sizeof(int), q));
  num[0] = 1; num[1] = 1; num[2] = 0;
  q.submit([&](handler& cgh) {
    cgh.single_task<class tess>([=]() mutable {
      num[2] = num[0] + num[1];
    });//task
  });//que
  q.wait();
  std::cout << "1 + 1 = " << num[2] << std::endl;
  num[0] = 1; num[1] = 1; num[2] = 0;

  int test = 0;
  #pragma omp target
  {
    test = 1;
    //num[2] = num[0] + num[1];
  }
  std::cout << test << std::endl;
  std::cout << "1 + 1 = " << num[2] << std::endl;
  return 0;
}
