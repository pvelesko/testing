#include <CL/sycl.hpp>
 
#include <algorithm>
#include <vector>
#include <string>
#include <iostream>
#include <cmath>
#include <numeric>
#include <chrono>
 
#define INNER_ITER 512
#define NUM_ITER 8
#define N 33554432    // 2^25
 
constexpr cl::sycl::access::mode sycl_read = cl::sycl::access::mode::read;
constexpr cl::sycl::access::mode sycl_write = cl::sycl::access::mode::write;
 
class MyKernel;
 
class MyKernel2;
 
void fma(const float* VA, const float* VB, float* VC, size_t length, int RATIO) {
 
  size_t bs1 = length * RATIO / 10;
  size_t bs2 = length - bs1;
 
  auto bufA = cl::sycl::buffer<float, 1>(VA, cl::sycl::range<1>(length));
  auto bufB = cl::sycl::buffer<float, 1>(VB, cl::sycl::range<1>(length));
  auto bufC = cl::sycl::buffer<float, 1>(VC, cl::sycl::range<1>(length));
 
  if (bs1 != 0) {
    cl::sycl::gpu_selector gpu_sel;
    cl::sycl::queue q1(gpu_sel);
    cl::sycl::range<1> numOfItems1{bs1};
    cl::sycl::buffer<float, 1> bufferA(bufA, cl::sycl::id<1>(0), cl::sycl::range<1>(numOfItems1));
    cl::sycl::buffer<float, 1> bufferB(bufB, cl::sycl::id<1>(0), cl::sycl::range<1>(numOfItems1));
    cl::sycl::buffer<float, 1> bufferC(bufC, cl::sycl::id<1>(0), cl::sycl::range<1>(numOfItems1));
    q1.submit([&](cl::sycl::handler& cgh) {
        auto a = bufferA.template get_access<sycl_read>(cgh);
        auto b = bufferB.template get_access<sycl_read>(cgh);
        auto c = bufferC.template get_access<sycl_write>(cgh);
        cgh.parallel_for<class MyKernel>(
          cl::sycl::range<1>(cl::sycl::range<1>(bs1)), [=](cl::sycl::item<1> item) {
            cl::sycl::id<1> wiID = item.get_id();
            float sum = 0;
            for (int i = 0; i < INNER_ITER; i++)
            sum += a[wiID] * b[wiID];
            c[wiID] = sum;
            });
        });
  }
 
  if (bs2 != 0) {
    cl::sycl::cpu_selector cpu_sel;
    cl::sycl::queue q2(cpu_sel);
 
    cl::sycl::range<1> numOfItems2{bs2};
    cl::sycl::buffer<float, 1> bufferX(bufA, cl::sycl::id<1>(bs1), cl::sycl::range<1>(numOfItems2));
    cl::sycl::buffer<float, 1> bufferY(bufB, cl::sycl::id<1>(bs1), cl::sycl::range<1>(numOfItems2));
    cl::sycl::buffer<float, 1> bufferZ(bufC, cl::sycl::id<1>(bs1), cl::sycl::range<1>(numOfItems2));
    q2.submit([&](cl::sycl::handler& cgh) {
        auto a = bufferX.template get_access<sycl_read>(cgh);
        auto b = bufferY.template get_access<sycl_read>(cgh);
        auto c = bufferZ.template get_access<sycl_write>(cgh);
        cgh.parallel_for<class MyKernel2>(
          cl::sycl::nd_range<1>( cl::sycl::range<1>(bs2), cl::sycl::range<1>(256), cl::sycl::id<1>(bs1)),
            [=](cl::sycl::item<1> item) {
            cl::sycl::id<1> wiID = item.get_linear_id();
            float sum = 0;
            for (int i = 0; i < INNER_ITER; i++)
            sum += a[wiID] * b[wiID];
            c[wiID] = sum;
            });
        });
  }
}
 
 
int main(int argc, char** argv) {
  //std::vector<cl::sycl::cl_float> a(N);
  //std::vector<cl::sycl::cl_float> b(N);
  //std::vector<cl::sycl::cl_float> c(N);
  float* a = (float*) _mm_malloc(N*sizeof(float), 64);
  float* b = (float*) _mm_malloc(N*sizeof(float), 64);
  float* c = (float*) _mm_malloc(N*sizeof(float), 64);
 
 
  for (int RATIO = 5; RATIO <= 5; RATIO++) {
    double average = 0.0;
    long minTime = 1000000.0, maxTime = 0.0;
 
    std::cout << "RATIO :" << RATIO << std::endl;
    for(uint k = 0; k < NUM_ITER; k++) {
 
      auto start = std::chrono::steady_clock::now();
      fma(a, b, c, N, RATIO);
      auto end = std::chrono::steady_clock::now();
      auto time =
        std::chrono::duration_cast<std::chrono::milliseconds>(end - start)
        .count();
      average += time;
      minTime = std::min(minTime, time);
      maxTime = std::max(maxTime, time);
    }
 
    std::cout << "avg Time: " << average/NUM_ITER << std::endl;
    std::cout << "min Time: " << minTime << std::endl;
    std::cout << "max Time: " << maxTime << std::endl;
 
 
  }
  return 0;
}

