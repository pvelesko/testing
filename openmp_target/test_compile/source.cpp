#include <iostream>
#include <cstdlib>
#include <random>
int main()
{

  int a[10];
  #pragma omp target map(tofrom:a[0:9])
  {
    a[3] = 1;
  }
  std::cout << a[3] << std::endl;
  return 0;
}

