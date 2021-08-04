#include <iostream>
#include "CL/sycl.hpp"
using namespace cl::sycl;
extern "C" void  hellodpcpp_(int* num_in) { // add trailing underscore to match mangled names
  int num = *num_in;
  std::cout << "Hello From DPC++. F Recv: " << num << std::endl;
  auto q = queue(default_selector{});
  int* t = (int*) malloc_shared(1 * sizeof(int), q);
  q.submit([&](handler& cgh) {
    cgh.single_task<class test>([=]()  {
      t[0] = num;
    }); // task
  }); // queue
  q.wait();
  std::cout << (t[0] == num ? "pass" : "fail") << std::endl;
}
