#include <stdio.h>
#include <CL/cl.hpp>
int main()
{
    int a = 1;
    int b = 2;
    int c = 0;

#pragma omp target
    {
       c = a + b;
    }
#pragma omp parallel num_threads(2)
    printf("c=%d\n", c);
}
