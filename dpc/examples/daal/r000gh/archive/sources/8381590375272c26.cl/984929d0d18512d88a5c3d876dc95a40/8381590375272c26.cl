//  ab1 ab2 ab k8 acb
__attribute__((intel_reqd_sub_group_size(8)))
kernel void dgemm_kernel_24_16(long mapping, long m, long n, long k, global void *base, uint offset_A, uint offset_B, global void *C, long offset_C, long ldc, long diag_C) {
    global volatile int *____;
    (void) ____[get_local_id(0)];
    (void) ____[get_enqueued_local_size(0)];
}
 