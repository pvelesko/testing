#include "stdlib.h"
#include "math.h"
#include "omp.h"
int our_function(int num_numbers, int *numbers) {
    int i;
    int sum = 0;

#pragma omp parallel
{
    printf("Hello\n");
    #pragma omp for  reduction(+:sum)
    for (i = 0; i < num_numbers; i++) {
        sum += numbers[i] * numbers[i] + random();
    }
}
    return sum;
}

int main()
{
    const int size = 10000000;
    int nums[size];
    double t;
    t = omp_get_wtime();
    int test = our_function(size, nums);
    t = omp_get_wtime() - t;
    printf("Time: %f\n", t);
}
