//  s24 b24 lx x24 y4
#pragma OPENCL EXTENSION cl_khr_fp64 : enable
__attribute__((intel_reqd_sub_group_size(8)))
kernel void dtrsm_ilnncopy_24(long n, long m, global void *S, long offset_S, long lds, double alpha_real, double alpha_imag, global void *D, long offset_D, long diag) {
    global volatile int *____;
    (void) ____[get_local_id(0)];
    (void) ____[get_enqueued_local_size(0)];
}
 