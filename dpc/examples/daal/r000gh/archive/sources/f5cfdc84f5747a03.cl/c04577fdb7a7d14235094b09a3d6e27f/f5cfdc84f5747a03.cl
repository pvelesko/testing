

# ifdef _DOUBLE
# define real_t double
# else
# define real_t float
# endif

# ifdef _COMPLEX
# define COMPLEX_ADJUSTMENT 2 // adjusting kernels for complex types
  inline void SQRT(global real_t *a) {
    a[0] = sqrt(a[0]);
    a[1] = 0;
  }
  inline void DIV(global real_t *a, global real_t *b) {
    real_t re = (a[0]*b[0]+a[1]*b[1])/(b[0]*b[0]+b[1]*b[1]);
    real_t im = (a[1]*b[0]-a[0]*b[1])/(b[0]*b[0]+b[1]*b[1]);
    a[0] = re;
    a[1] = im;
  }
  inline void MULSUB(global real_t *a, global real_t *b, global real_t *c) {
    a[0] -=  b[0]*c[0]+b[1]*c[1];
    a[1] -= -b[0]*c[1]+b[1]*c[0];
  }
# else
# define COMPLEX_ADJUSTMENT 1 // adjusting kernels for real types
  inline void SQRT   (global real_t *a) { a[0] = sqrt(a[0]); }
  inline void DIV    (global real_t *a, global real_t *b) { a[0] /= b[0]; }
  inline void MULSUB (global real_t *a, global real_t *b, global real_t *c) { a[0] -= b[0]*c[0]; }
# endif

# define A(i,j) a[i*lda*COMPLEX_ADJUSTMENT+j*COMPLEX_ADJUSTMENT]

  __kernel void potrf_u(global real_t *a, int lda, int n, int offset, global int *info)
  {
    a = a + offset*COMPLEX_ADJUSTMENT;
    for (int j=0; j<n; j++) {
      if (A(j,j) <= 0) {
        if (*info == 0) *info = j+1;
        break;
      }
      SQRT(&A(j,j)); /* A(j,j) = sqrt(A(j,j)); */
      for (int i=j+1; i<n; i++) {
        DIV(&A(i,j), &A(j,j)); /* A(i,j) /= A(j,j); */
      }
      for (int k=j+1; k<n; k++) {
        for (int i=k; i<n; i++) {
          MULSUB(&A(i,k),&A(i,j),&A(k,j)); /* A(i,k) -= A(i,j)*A(k,j); */
        }
      }
    }
  }

  __kernel void potrf_l(global real_t *a, int lda, int n, int offset, global int *info)
  {
    a = a + offset*COMPLEX_ADJUSTMENT;
    for (int j=0; j<n; j++) {
      if (A(j,j) <= 0) {
        if (*info == 0) *info = j+1;
        break;
      }
      SQRT(&A(j,j)); /* A(j,j) = sqrt(A(j,j)); */
      for (int i=j+1; i<n; i++) {
        DIV(&A(j,i), &A(j,j)); /* A(j,i) /= A(j,j); */
      }
      for (int k=j+1; k<n; k++) {
        for (int i=k; i<n; i++) {
          MULSUB(&A(k,i),&A(j,i),&A(j,k)); /* A(k,i) -= A(j,i)*A(j,k); */
        }
      }
    }
  }
 