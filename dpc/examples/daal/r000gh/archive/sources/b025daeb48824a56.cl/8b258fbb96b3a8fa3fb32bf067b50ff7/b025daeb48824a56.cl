//  ab4/2 as4 ab k8 cs
#pragma OPENCL EXTENSION cl_khr_fp64 : enable
__attribute__((intel_reqd_sub_group_size(8)))
kernel void dgemm_nocopy_nn_32_8(global void *A, global void *B, global void *C, long offset_A, long offset_B, long offset_C, uint lda, uint ldb, uint ldc, int m, int n, int k, int diag_C, double alpha_real, double beta_real) {
    global volatile int *____;
    (void) ____[get_local_id(0)];
    (void) ____[get_enqueued_local_size(0)];
}
 