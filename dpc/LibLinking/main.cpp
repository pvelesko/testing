#include "foobar.h"

int main()
{
  int a = 5;
  int b = foo(a);
  int c;

  foo(b);

//  #pragma omp target map(to: a, b) map(from: c)
  {
    c = a + b;
  }
  return 0;
}
