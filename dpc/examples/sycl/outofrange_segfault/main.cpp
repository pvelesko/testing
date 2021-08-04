#include <CL/sycl.hpp>
#include "SyclUtil.hpp"
#include <stdlib.h>
#include <iostream>
using namespace cl::sycl;
int main(int argc, char** argv) {
  process_args(argc, argv);
  init();
  int* x = static_cast<int*>(malloc_host(3 * sizeof(int), q));
  q.submit([&](handler& cgh) {
    cgh.single_task<class test>([=]() {
      x[5] = 0;
    }); // task
  }); // queue
  q.wait_and_throw();
  return 0;
}
