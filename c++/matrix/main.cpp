#include <iostream>
#include <CL/sycl.hpp>

using namespace cl::sycl;
template<class T>
class MatrixUSM2D {
  public:
  T* data;
  int dim0;
  int dim1;
  context* ctx;
  device* dev;
  MatrixUSM2D(int dim0_in, int dim1_in, device &dev_in, context &ctx_in) {
    ctx = &ctx_in;
    dev = &dev_in;
    dim0 = dim0_in;
    dim1 = dim1_in;
    data = static_cast<T*>(malloc_shared(dim0 * dim1 * sizeof(T), *dev, *ctx));

    int dim;
    if (!std::is_pointer<T>::value) dim = 0;

    typedef typename std::remove_pointer<T>::type T1;
    typedef typename std::remove_pointer<T1>::type T2;
    typedef typename std::remove_pointer<T2>::type T3;
    typedef typename std::remove_pointer<T3>::type T4;

    
    if (std::is_pointer<T >::value) dim++;
    if (std::is_pointer<T1>::value) dim++;
    if (std::is_pointer<T2>::value) dim++;
    if (std::is_pointer<T3>::value) dim++;
    if (std::is_pointer<T4>::value) dim++;

  }
  ~MatrixUSM2D() {
    cl::sycl::free(data, *ctx);
  };

  T& operator()(int x, int y) {
    return data[x *dim0 + y];
  };

};

int main() {
  queue q(gpu_selector{});
  device dev = q.get_device();
  context ctx = q.get_context();
  std::cout << "Running on "
            << dev.get_info<info::device::name>()
            << std::endl;

  MatrixUSM2D<float> m(3, 3, dev, ctx);
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++)
      m(i, j) = 0;

  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++)
      std::cout << m(i, j) << std::endl;
  std::cout << std::endl;
  m(2, 1) = 1;
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++)
  std::cout << m(i, j) << std::endl;
  return 0;
}
