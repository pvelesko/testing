//  s16 b16 lx x16 y8 b8
#pragma OPENCL EXTENSION cl_khr_fp64 : enable
__attribute__((intel_reqd_sub_group_size(8)))
kernel void dgemm_oncopy_16(long m, long n, global void *S, long offset_S, long lds, double alpha_real, double alpha_imag, global void *D, long offset_D, long diag) {
    global volatile int *____;
    (void) ____[get_local_id(0)];
    (void) ____[get_enqueued_local_size(0)];
    barrier(CLK_GLOBAL_MEM_FENCE);
}
 