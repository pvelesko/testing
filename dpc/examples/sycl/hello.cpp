#include <iostream>
#include "CL/sycl.hpp"
using namespace cl::sycl;
extern "C" void  hellodpcpp_(int num) { // add trailing underscore to match mangled names
  std::cout << "Hello From DPC++. Recv from F:" << num << std::endl;
  int t = 0;
  auto q = queue(default_selector{});
  q.submit([&](handler& cgh) {
    cgh.single_task<class test>([=]() mutable {
      t = num;
    }); // task
  }); // queue
  q.wait();
  std::cout << (t == num ? "pass" : "fail") << std::endl;
}
