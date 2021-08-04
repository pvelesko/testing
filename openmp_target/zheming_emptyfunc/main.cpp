#pragma omp declare target
void work1(int k) { k = 0;}
#pragma omp end declare target
#pragma omp declare target
void work2(int k) { k = 0;}
#pragma omp end declare target


int main() {
  int n=10;
  int i;
  #pragma omp target
  {
      for (i=0; i<n; i++)
        work1(i);
      for (i=0; i<n; i++)
        work2(i);
 }
 return 0;
}
