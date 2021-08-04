
__attribute__((intel_reqd_sub_group_size(8)))
kernel void binary_test(uint src0, ulong src1, ushort src2, ushort src3,
                        ulong src4, ulong src5, global uint *src_ptr,
                        global uint *ok)
{
    global volatile uint *p = src_ptr;
    (void) p[get_local_id(0)];
    (void) p[get_enqueued_local_size(0)];
    *ok = 0;
}
 