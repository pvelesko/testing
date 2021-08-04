#include "CL/sycl.hpp"

  class CUDASelector : public cl::sycl::device_selector {
  public:
    int operator()(const cl::sycl::device &Device) const override {

      const std::string DriverVersion = Device.get_info<cl::sycl::info::device::driver_version>();

      if (Device.is_gpu() && (DriverVersion.find("CUDA") != std::string::npos)) {
        return 1;
      };
      return -1;
    }
};
using namespace cl::sycl;

int main() {
  auto q = queue(CUDASelector{});
  return 0;
}
