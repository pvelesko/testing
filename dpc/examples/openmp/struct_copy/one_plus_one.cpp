#include <iostream>
int main() {

  struct strt{
    int* a;
  };

  strt* test_struct;
  test_struct->a = (int*)malloc(3*sizeof(int));
  test_struct->a[0] = 1;
  test_struct->a[1] = 1;
  test_struct->a[2] = 0;

  auto* a = test_struct->a;
  #pragma omp target map(to: test_struct[0:1]) map(tofrom: a[0:3])
  {
    // associate device pointer
    test_struct->a = a;
    // actual computation
    test_struct->a[2] = test_struct->a[0] + test_struct->a[1];
  }

  std::cout << "1 + 1 = " << test_struct->a[2] << std::endl;
  return 0;
}
