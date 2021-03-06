typedef signed int xint;
typedef unsigned int uxint;
typedef signed long xlong;
typedef unsigned long uxlong;
__kernel void dgemm_beta_alt(xlong m, xlong n, double alpha_r, double alpha_i, __global double *a, xlong offset, xlong lda) {
  xint idx = get_group_id(0);
  xint idy = get_group_id(1);
  xint lid = get_local_id(0);
  xint j;
  double alpha = (double)(alpha_r);
  ;
  m -= 24 * idx; if (m > 24) m = 24;
  n -= 16 * idy; if (n > 16) n = 16;
  if ((m <= 0) || (n <= 0)) return;
  m -= lid;
  offset += (24 * idx + lid) + 16 * idy * lda;
  if (
      alpha == 0.
      ) {
    for (j = 0; j < n; j ++) {
      if ((m > 0*8) ) a[offset + 0*8] = 0.;
      if ((m > 1*8) ) a[offset + 1*8] = 0.;
      if ((m > 2*8) ) a[offset + 2*8] = 0.;
      offset += lda;
    }
  } else {
    for (j = 0; j < n; j ++) {
      if ((m > 0*8) ) a[offset + 0*8] = (double)((alpha) * (a[offset + 0*8]));
      if ((m > 1*8) ) a[offset + 1*8] = (double)((alpha) * (a[offset + 1*8]));
      if ((m > 2*8) ) a[offset + 2*8] = (double)((alpha) * (a[offset + 2*8]));
      offset += lda;
    }
  }
}
 